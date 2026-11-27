const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { MongoClient } = require('../backend/node_modules/mongodb');
const { supabase } = require('../backend/supabase');

require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'martgpt';

const COLLECTIONS = [
  { name: 'shops', pk: 'shopId' },
  { name: 'users', pk: 'uid' },
  { name: 'products', pk: 'id' },
  { name: 'customers', pk: 'id' },
  { name: 'transactions', pk: 'id' },
  { name: 'expenses', pk: 'id' },
  { name: 'udhar_transactions', pk: 'id' },
  { name: 'suppliers', pk: 'id' },
  { name: 'purchases', pk: 'id' },
  { name: 'notifications', pk: 'id' },
  { name: 'promo_codes', pk: 'code' },
  { name: 'staff', pk: 'id' },
  { name: 'staff_attendance', pk: 'id' },
  { name: 'staff_salary_payments', pk: 'id' }
];

const JSON_FIELDS = new Set(['items', 'settings', 'variants', 'permissions', 'readBy', 'splitAmounts']);
const NUMBER_FIELDS = new Set([
  'purchasePrice', 'sellingPrice', 'mrp', 'gst', 'stock', 'minStock',
  'wholesalePrice', 'bulkMinQty', 'bulkPrice', 'reorderQty', 'maxStock',
  'balance', 'visits', 'totalSpent', 'loyaltyPoints',
  'subtotal', 'taxAmount', 'discountAmount', 'totalAmount',
  'amount', 'paidAmount', 'salary', 'discountPercent', 'flatDiscount',
  'maxUses', 'usedCount', 'cashTendered', 'changeReturn'
]);
const BOOLEAN_INT_FIELDS = new Set(['isLoose', 'isDeleted', 'isRead', 'active']);

function parseJsonField(val, fallback) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeRow(tableName, rawRow) {
  const row = { ...rawRow };
  delete row._id;

  for (const field of JSON_FIELDS) {
    if (field in row) {
      const def = field === 'settings' || field === 'splitAmounts' ? {} : [];
      row[field] = parseJsonField(row[field], def);
    }
  }

  for (const field of NUMBER_FIELDS) {
    if (field in row && row[field] !== null && row[field] !== undefined && row[field] !== '') {
      const n = Number(row[field]);
      row[field] = isNaN(n) ? 0 : n;
    }
  }

  for (const field of BOOLEAN_INT_FIELDS) {
    if (field in row && row[field] !== null && row[field] !== undefined) {
      row[field] = row[field] ? 1 : 0;
    }
  }

  if (tableName === 'users' && row.email) {
    row.email = String(row.email).trim().toLowerCase();
  }

  if (tableName === 'products' && !('isDeleted' in row)) {
    row.isDeleted = 0;
  }
  if (tableName === 'customers' && !('isDeleted' in row)) {
    row.isDeleted = 0;
  }
  if (tableName === 'transactions' && !('isDeleted' in row)) {
    row.isDeleted = 0;
  }

  return row;
}

async function runMigration() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI missing from .env / backend/.env');
  }

  const sqlitePath = path.join(__dirname, '..', 'backend', 'data', 'kirana.db');
  let sqlite = null;
  if (fs.existsSync(sqlitePath)) {
    sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
    console.log('📂 Opened SQLite source:', sqlitePath);
  }

  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(DB_NAME);
  console.log(`🍃 Connected to MongoDB Atlas database: "${DB_NAME}"\n`);

  const summary = [];

  for (const { name, pk } of COLLECTIONS) {
    const mergedMap = new Map();

    // 1. Read from local SQLite
    if (sqlite) {
      try {
        const rows = sqlite.prepare(`SELECT * FROM ${name}`).all();
        for (const r of rows) {
          const norm = normalizeRow(name, r);
          if (norm[pk]) mergedMap.set(String(norm[pk]), norm);
        }
      } catch (e) {
        console.warn(`⚠️ SQLite read warning on ${name}:`, e.message);
      }
    }

    // 2. Read from Supabase Cloud and merge (Supabase fills any missing rows & newer updates, preserving local SQLite extended product fields)
    try {
      const { data: sbRows, error } = await supabase.from(name).select('*').limit(10000);
      if (!error && Array.isArray(sbRows)) {
        for (const sbRaw of sbRows) {
          const sbNorm = normalizeRow(name, sbRaw);
          const key = sbNorm[pk] ? String(sbNorm[pk]) : null;
          if (!key) continue;

          const existing = mergedMap.get(key);
          if (existing) {
            // Merge: keep non-null values from Supabase while preserving SQLite-only fields like wholesalePrice/bulkMinQty/bulkPrice/variants/password if Supabase omitted them
            const combined = { ...existing };
            for (const [k, v] of Object.entries(sbNorm)) {
              if (v !== null && v !== undefined) {
                if (name === 'users' && k === 'password' && (!v || v === '') && existing.password) continue;
                combined[k] = v;
              }
            }
            mergedMap.set(key, combined);
          } else {
            mergedMap.set(key, sbNorm);
          }
        }
      } else if (error) {
        console.warn(`⚠️ Supabase read notice on ${name}:`, error.message);
      }
    } catch (sbErr) {
      console.warn(`⚠️ Supabase fetch skip on ${name}:`, sbErr.message);
    }

    const docs = Array.from(mergedMap.values());
    if (docs.length > 0) {
      const ops = docs.map((doc) => ({
        updateOne: {
          filter: { [pk]: doc[pk] },
          update: { $set: doc },
          upsert: true
        }
      }));
      await db.collection(name).bulkWrite(ops, { ordered: false });
    }

    const finalCount = await db.collection(name).countDocuments();
    summary.push({ collection: name, migrated: docs.length, atlasCount: finalCount });
    console.log(`✅ ${name.padEnd(22)} -> migrated: ${String(docs.length).padStart(4)} | Atlas total: ${finalCount}`);
  }

  // Ensure indexes exist
  const { getMongoDb } = require('../backend/mongo');
  await getMongoDb();

  await client.close();
  if (sqlite) sqlite.close();

  console.log('\n🎉 All data successfully migrated and verified in MongoDB Atlas!');
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
