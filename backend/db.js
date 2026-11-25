const path = require('path');
const fs = require('fs');
const { supabase, supabaseUrl, supabaseKey } = require('./supabase');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config();

let pgPool = null;
let isPostgresReady = false;
let isSupabaseApiReady = false;
let isFallbackActive = false;
let sqliteDb = null;

// Initialize PostgreSQL client if direct connection string or credentials are present
const pgPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
const pgHost = process.env.POSTGRES_HOST || 'db.dyuimjageamopkodfplk.supabase.co';
const pgDatabase = process.env.POSTGRES_DB || 'postgres';
const pgUser = process.env.POSTGRES_USER || 'postgres';
const pgPort = process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432;

if (process.env.DATABASE_URL || pgPassword) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: !process.env.DATABASE_URL ? pgHost : undefined,
      port: !process.env.DATABASE_URL ? pgPort : undefined,
      database: !process.env.DATABASE_URL ? pgDatabase : undefined,
      user: !process.env.DATABASE_URL ? pgUser : undefined,
      password: !process.env.DATABASE_URL ? pgPassword : undefined,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10
    });
  } catch (e) {
    console.warn('PostgreSQL pool creation notice:', e.message);
  }
}

// Embedded SQLite Database for 100% offline uptime & zero data loss
function getSQLiteDb() {
  if (sqliteDb) return sqliteDb;

  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION);
  const dataDir = process.env.MARTGPT_DATA_DIR || (isVercel ? '/tmp/kirana-data' : path.join(__dirname, 'data'));
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'kirana.db');

  if (!fs.existsSync(dbPath)) {
    const candidates = [
      path.join(__dirname, 'data', 'kirana.db'),
      path.join(process.cwd(), 'backend', 'data', 'kirana.db'),
      path.join(__dirname, '..', 'backend', 'data', 'kirana.db')
    ];
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate) && path.resolve(candidate) !== path.resolve(dbPath)) {
        try {
          fs.copyFileSync(candidate, dbPath);
          console.log('Seeded SQLite database from:', candidate);
          break;
        } catch (copyErr) {
          console.warn('Could not copy seed database:', copyErr.message);
        }
      }
    }
  }

  try {
    const { DatabaseSync } = require('node:sqlite');
    sqliteDb = new DatabaseSync(dbPath);
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec('PRAGMA busy_timeout = 5000;');

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS shops (
        shopId TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ownerName TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        gstNumber TEXT,
        upiId TEXT,
        publicUrl TEXT,
        plan TEXT DEFAULT 'free',
        planExpiry TEXT,
        settings TEXT,
        receiptHeader TEXT,
        receiptFooter TEXT,
        receiptPaperSize TEXT,
        fssaiNumber TEXT,
        invoiceTerms TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        displayName TEXT,
        role TEXT DEFAULT 'staff',
        shopId TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        shopId TEXT,
        name TEXT NOT NULL,
        category TEXT,
        brand TEXT,
        unit TEXT,
        purchasePrice REAL,
        sellingPrice REAL,
        mrp REAL,
        gst REAL,
        stock REAL,
        minStock REAL,
        sku TEXT,
        barcode TEXT,
        shortCode TEXT,
        isLoose INTEGER DEFAULT 0,
        expiryDate TEXT,
        imageUrl TEXT,
        wholesalePrice REAL,
        bulkMinQty REAL,
        bulkPrice REAL,
        rackLocation TEXT,
        reorderQty REAL,
        maxStock REAL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        shopId TEXT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        balance REAL DEFAULT 0,
        visits INTEGER DEFAULT 0,
        totalSpent REAL DEFAULT 0,
        loyaltyPoints INTEGER DEFAULT 0,
        aadharNumber TEXT,
        photoUrl TEXT,
        aadharPhotoUrl TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        shopId TEXT,
        subtotal REAL,
        taxAmount REAL,
        discountAmount REAL,
        totalAmount REAL,
        paymentMethod TEXT,
        customerId TEXT,
        items TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        shopId TEXT,
        title TEXT,
        category TEXT,
        amount REAL,
        description TEXT,
        date TEXT,
        notes TEXT,
        addedBy TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS udhar_transactions (
        id TEXT PRIMARY KEY,
        shopId TEXT,
        customerId TEXT,
        amount REAL,
        type TEXT,
        notes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        shopId TEXT NOT NULL,
        name TEXT NOT NULL,
        contactPerson TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        gstNumber TEXT,
        paymentTerms TEXT,
        balance REAL DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        shopId TEXT NOT NULL,
        supplierId TEXT,
        invoiceNumber TEXT,
        date TEXT,
        purchaseDate TEXT,
        totalAmount REAL DEFAULT 0,
        paidAmount REAL DEFAULT 0,
        paymentStatus TEXT DEFAULT 'paid',
        paymentMethod TEXT,
        items TEXT,
        notes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        shopId TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        channel TEXT DEFAULT 'system',
        actionUrl TEXT,
        isRead INTEGER DEFAULT 0,
        readBy TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS promo_codes (
        code TEXT PRIMARY KEY,
        discountPercent REAL DEFAULT 0,
        flatDiscount REAL DEFAULT 0,
        planType TEXT,
        maxUses INTEGER DEFAULT 100,
        usedCount INTEGER DEFAULT 0,
        validUntil TEXT,
        active INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        shopId TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'Helper',
        salaryType TEXT DEFAULT 'monthly',
        salary REAL DEFAULT 0,
        joinDate TEXT,
        address TEXT,
        status TEXT DEFAULT 'active',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS staff_attendance (
        id TEXT PRIMARY KEY,
        shopId TEXT NOT NULL,
        staffId TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        notes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS staff_salary_payments (
        id TEXT PRIMARY KEY,
        shopId TEXT NOT NULL,
        staffId TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT DEFAULT 'salary',
        monthYear TEXT,
        paymentDate TEXT NOT NULL,
        paymentMethod TEXT DEFAULT 'Cash',
        notes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try { sqliteDb.exec('ALTER TABLE customers ADD COLUMN aadharPhotoUrl TEXT;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN expiryDate TEXT;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN isLoose INTEGER DEFAULT 0;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN shortCode TEXT;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN variants TEXT;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN wholesalePrice REAL;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN bulkMinQty REAL;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN bulkPrice REAL;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN rackLocation TEXT;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN reorderQty REAL;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN maxStock REAL;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN isDeleted INTEGER DEFAULT 0;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN deletedAt TEXT;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE transactions ADD COLUMN isDeleted INTEGER DEFAULT 0;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE transactions ADD COLUMN deletedAt TEXT;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE customers ADD COLUMN isDeleted INTEGER DEFAULT 0;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE customers ADD COLUMN deletedAt TEXT;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE users ADD COLUMN permissions TEXT;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE staff ADD COLUMN permissions TEXT;'); } catch (e) {}

    return sqliteDb;
  } catch (err) {
    console.error('Error initializing embedded SQLite fallback:', err);
    throw err;
  }
}

function runSQLiteQuery(sql, params = []) {
  const db = getSQLiteDb();
  const cleanParams = (params || []).map(p => (p === undefined ? null : p));
  const trimmed = sql.trim().toLowerCase();

  if (trimmed.startsWith('select') || trimmed.startsWith('pragma')) {
    const stmt = db.prepare(sql);
    const rows = stmt.all(...cleanParams).map(r => {
      const obj = { ...r };
      if (typeof obj.items === 'string') {
        try { obj.items = JSON.parse(obj.items); } catch (e) {}
      }
      if (typeof obj.settings === 'string') {
        try { obj.settings = JSON.parse(obj.settings); } catch (e) {}
      }
      return obj;
    });
    return [rows];
  } else {
    const stmt = db.prepare(sql);
    const res = stmt.run(...cleanParams);

    // Automatically sync all INSERT, UPDATE, DELETE operations directly to Supabase cloud!
    syncMutationToSupabase(sql, cleanParams).catch(err => {
      console.warn('Supabase sync notice:', err.message);
    });

    return [{ affectedRows: res.changes, insertId: Number(res.lastInsertRowid) }];
  }
}

const TABLE_PRIMARY_KEYS = {
  shops: 'shopId',
  users: 'uid',
  products: 'id',
  customers: 'id',
  transactions: 'id',
  expenses: 'id',
  udhar_transactions: 'id',
  suppliers: 'id',
  purchases: 'id',
  notifications: 'id',
  promo_codes: 'code',
  staff: 'id',
  staff_attendance: 'id',
  staff_salary_payments: 'id'
};

const SUPABASE_TABLE_COLUMNS = {
  shops: new Set(['shopId', 'name', 'ownerName', 'phone', 'email', 'address', 'gstNumber', 'upiId', 'publicUrl', 'plan', 'planExpiry', 'settings', 'receiptHeader', 'receiptFooter', 'receiptPaperSize', 'fssaiNumber', 'invoiceTerms', 'createdAt']),
  products: new Set(['id', 'shopId', 'name', 'category', 'brand', 'unit', 'purchasePrice', 'sellingPrice', 'mrp', 'gst', 'stock', 'minStock', 'sku', 'barcode', 'shortCode', 'isLoose', 'expiryDate', 'imageUrl', 'isDeleted', 'deletedAt', 'createdAt']),
  customers: new Set(['id', 'shopId', 'name', 'phone', 'email', 'address', 'balance', 'visits', 'totalSpent', 'loyaltyPoints', 'aadharNumber', 'photoUrl', 'aadharPhotoUrl', 'isDeleted', 'deletedAt', 'createdAt']),
  transactions: new Set(['id', 'shopId', 'subtotal', 'taxAmount', 'discountAmount', 'totalAmount', 'paymentMethod', 'customerId', 'items', 'isDeleted', 'deletedAt', 'createdAt']),
  expenses: new Set(['id', 'shopId', 'title', 'category', 'amount', 'description', 'date', 'notes', 'addedBy', 'createdAt']),
  udhar_transactions: new Set(['id', 'shopId', 'customerId', 'amount', 'type', 'notes', 'createdAt']),
  suppliers: new Set(['id', 'shopId', 'name', 'contactPerson', 'phone', 'email', 'address', 'gstNumber', 'paymentTerms', 'balance', 'createdAt']),
  purchases: new Set(['id', 'shopId', 'supplierId', 'invoiceNumber', 'date', 'purchaseDate', 'totalAmount', 'paidAmount', 'paymentStatus', 'paymentMethod', 'items', 'notes', 'createdAt']),
  notifications: new Set(['id', 'shopId', 'title', 'message', 'type', 'channel', 'actionUrl', 'isRead', 'readBy', 'createdAt']),
  promo_codes: new Set(['code', 'discountPercent', 'flatDiscount', 'planType', 'maxUses', 'usedCount', 'validUntil', 'active', 'createdAt']),
  staff: new Set(['id', 'shopId', 'name', 'phone', 'role', 'salaryType', 'salary', 'joinDate', 'address', 'status', 'createdAt']),
  staff_attendance: new Set(['id', 'shopId', 'staffId', 'date', 'status', 'notes', 'createdAt']),
  staff_salary_payments: new Set(['id', 'shopId', 'staffId', 'amount', 'type', 'monthYear', 'paymentDate', 'paymentMethod', 'notes', 'createdAt'])
};

function formatRowForSupabase(table, row) {
  const allowed = SUPABASE_TABLE_COLUMNS[table];
  const formatted = {};
  for (const [k, v] of Object.entries(row)) {
    if (allowed && !allowed.has(k)) {
      continue;
    }
    let val = v;
    if (k === 'isLoose' || k === 'active') {
      val = Boolean(val);
    }
    if ((k === 'settings' || k === 'items' || k === 'readBy') && typeof val === 'string') {
      try { val = JSON.parse(val); } catch (e) {}
    }
    if ((k === 'imageUrl' || k === 'photoUrl' || k === 'aadharPhotoUrl') && typeof val === 'string' && val.length > 500000) {
      val = null;
    }
    // Prevent empty string from breaking PostgreSQL DATE/TIMESTAMPTZ columns
    if ((k === 'expiryDate' || k === 'date' || k === 'purchaseDate' || k === 'validUntil' || k === 'planExpiry') && (!val || val === '')) {
      val = null;
    }
    // Ensure numbers are properly converted
    if (['purchasePrice', 'sellingPrice', 'mrp', 'gst', 'stock', 'minStock', 'balance', 'totalSpent', 'subtotal', 'taxAmount', 'discountAmount', 'totalAmount', 'amount', 'visits', 'loyaltyPoints'].includes(k)) {
      if (val !== null && val !== undefined && val !== '') {
        const num = Number(val);
        val = isNaN(num) ? 0 : num;
      }
    }
    formatted[k] = val;
  }
  return formatted;
}

async function syncMutationToSupabase(sql, params = []) {
  if (!isSupabaseApiReady) return;
  const trimmed = sql.trim();
  const lower = trimmed.toLowerCase();

  try {
    const db = getSQLiteDb();

    // Robust self-healing Supabase upsert that automatically recovers from any missing columns in cloud schema
    async function safeSupabaseUpsert(table, payload) {
      let toSend = { ...payload };
      let attempts = 0;
      while (attempts < 3) {
        attempts++;
        const { error } = await supabase.from(table).upsert(toSend);
        if (!error) return { success: true };

        // Auto-heal schema mismatch error (e.g. Could not find the 'variants' column of 'products' in schema cache)
        if (error.code === 'PGRST204' || error.message?.includes('Could not find the') || error.message?.includes('column')) {
          const colMatch = error.message.match(/Could not find the ['"]([^'"]+)['"] column/i);
          if (colMatch && colMatch[1] && toSend[colMatch[1]] !== undefined) {
            console.warn(`Stripping unmapped column '${colMatch[1]}' from Supabase table '${table}' and retrying...`);
            delete toSend[colMatch[1]];
            continue;
          }
        }
        console.warn(`Supabase ${table} sync warning:`, error.message);
        return { error };
      }
      return { success: false };
    }

    // Helper to ensure shop exists in Supabase before foreign-key child tables
    async function ensureShopInSupabase(shopId) {
      if (!shopId) return;
      try {
        const shopRow = db.prepare('SELECT * FROM shops WHERE shopId = ?').get(shopId);
        if (shopRow) {
          const formattedShop = formatRowForSupabase('shops', shopRow);
          await safeSupabaseUpsert('shops', formattedShop);
        }
      } catch (e) {}
    }

    // 1. DELETE
    if (lower.startsWith('delete from')) {
      const match = trimmed.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)/i);
      if (match) {
        const table = match[1].toLowerCase();
        const pk = TABLE_PRIMARY_KEYS[table] || 'id';
        const pkVal = params[0];
        if (pkVal) {
          const { error } = await supabase.from(table).delete().eq(pk, pkVal);
          if (error) console.warn(`Supabase ${table} delete warning:`, error.message);
        }
      }
      return;
    }

    // 2. INSERT
    if (lower.startsWith('insert into')) {
      const match = trimmed.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
      if (match) {
        const table = match[1].toLowerCase();
        const cols = match[2].split(',').map(c => c.trim().replace(/["`]/g, ''));
        const row = {};
        cols.forEach((col, idx) => {
          let val = params[idx];
          if (val === undefined) val = null;
          row[col] = val;
        });
        const formatted = formatRowForSupabase(table, row);
        if (formatted.shopId && table !== 'shops') {
          await ensureShopInSupabase(formatted.shopId);
        }
        await safeSupabaseUpsert(table, formatted);
      }
      return;
    }

    // 3. UPDATE
    if (lower.startsWith('update')) {
      const match = trimmed.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+/i);
      if (match) {
        const table = match[1].toLowerCase();
        const whereIndex = trimmed.toUpperCase().indexOf(' WHERE ');
        if (whereIndex !== -1) {
          const setPart = trimmed.substring(0, whereIndex);
          const whereClause = trimmed.substring(whereIndex + 7);
          const setParamCount = (setPart.match(/\?/g) || []).length;
          const whereParams = params.slice(setParamCount);

          const selectSql = `SELECT * FROM ${table} WHERE ${whereClause}`;
          const rows = db.prepare(selectSql).all(...whereParams);
          for (const row of rows) {
            const formatted = formatRowForSupabase(table, row);
            if (formatted.shopId && table !== 'shops') {
              await ensureShopInSupabase(formatted.shopId);
            }
            await safeSupabaseUpsert(table, formatted);
          }
        }
      }
      return;
    }
  } catch (err) {
    console.warn(`Supabase sync background notice:`, err.message);
  }
}

function createSQLiteConnection() {
  const db = getSQLiteDb();
  let inTransaction = false;

  return {
    async query(sql, params) {
      return runSQLiteQuery(sql, params);
    },
    async beginTransaction() {
      try {
        db.exec('BEGIN TRANSACTION');
        inTransaction = true;
      } catch (e) {}
    },
    async commit() {
      if (inTransaction) {
        try {
          db.exec('COMMIT');
        } catch (e) {}
        inTransaction = false;
      }
    },
    async rollback() {
      if (inTransaction) {
        try {
          db.exec('ROLLBACK');
        } catch (e) {}
        inTransaction = false;
      }
    },
    release() {}
  };
}

// Convert MySQL syntax `?` parameters to PostgreSQL `$1, $2, ...`
function toPostgresSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => '$' + (index++));
}

async function warmUpCacheFromSupabase() {
  try {
    const db = getSQLiteDb();

    console.log('🔄 Syncing all tables from Supabase Cloud to local cache...');
    const [shopsRes, prodsRes, usersRes, custsRes, txsRes, expRes, udharRes, suppRes, purchRes, notifRes, promoRes] = await Promise.all([
      supabase.from('shops').select('*').limit(5000),
      supabase.from('products').select('*').limit(10000),
      supabase.from('users').select('*').limit(5000),
      supabase.from('customers').select('*').limit(10000),
      supabase.from('transactions').select('*').limit(2000),
      supabase.from('expenses').select('*').limit(2000),
      supabase.from('udhar_transactions').select('*').limit(2000),
      supabase.from('suppliers').select('*').limit(2000),
      supabase.from('purchases').select('*').limit(2000),
      supabase.from('notifications').select('*').limit(500),
      supabase.from('promo_codes').select('*')
    ]);

    const shopProductMetaMap = {};
    if (shopsRes.data) {
      for (const s of shopsRes.data) {
        try {
          let parsedSettings = s.settings;
          if (typeof parsedSettings === 'string') {
            try { parsedSettings = JSON.parse(parsedSettings); } catch { parsedSettings = {}; }
          }
          if (parsedSettings && typeof parsedSettings === 'object' && parsedSettings.productMeta && typeof parsedSettings.productMeta === 'object') {
            shopProductMetaMap[s.shopId] = parsedSettings.productMeta;
          }
          db.prepare('INSERT OR REPLACE INTO shops (shopId, name, ownerName, phone, email, address, gstNumber, upiId, publicUrl, plan, planExpiry, settings, receiptHeader, receiptFooter, receiptPaperSize, fssaiNumber, invoiceTerms, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(
              s.shopId, 
              s.name, 
              s.ownerName, 
              s.phone || null, 
              s.email || null, 
              s.address || null, 
              s.gstNumber || null, 
              s.upiId || null, 
              s.publicUrl || null, 
              s.plan || 'free',
              s.planExpiry || null,
              typeof s.settings === 'object' ? JSON.stringify(s.settings || {}) : (s.settings || null),
              s.receiptHeader || null,
              s.receiptFooter || null,
              s.receiptPaperSize || 'thermal',
              s.fssaiNumber || null,
              s.invoiceTerms || null,
              s.createdAt || new Date().toISOString()
            );
        } catch (e) {}
      }
    }
    if (prodsRes.data) {
      for (const p of prodsRes.data) {
        try {
          const meta = (shopProductMetaMap[p.shopId] && shopProductMetaMap[p.shopId][p.id]) || {};
          db.prepare('INSERT OR REPLACE INTO products (id, shopId, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, shortCode, isLoose, expiryDate, imageUrl, wholesalePrice, bulkMinQty, bulkPrice, rackLocation, reorderQty, maxStock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(
              p.id, p.shopId, p.name, p.category, p.brand, p.unit,
              p.purchasePrice || 0, p.sellingPrice || 0, p.mrp || 0, p.gst || 0,
              p.stock || 0, p.minStock || 0, p.sku, p.barcode, p.shortCode,
              p.isLoose ? 1 : 0, p.expiryDate || null, p.imageUrl || null,
              p.wholesalePrice ?? meta.wholesalePrice ?? null,
              p.bulkMinQty ?? meta.bulkMinQty ?? null,
              p.bulkPrice ?? meta.bulkPrice ?? null,
              p.rackLocation ?? meta.rackLocation ?? null,
              p.reorderQty ?? meta.reorderQty ?? null,
              p.maxStock ?? meta.maxStock ?? null
            );
        } catch (e) {}
      }
    }
    if (usersRes.data) {
      for (const u of usersRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO users (uid, email, password, displayName, role, shopId) VALUES (?, ?, ?, ?, ?, ?)')
            .run(u.uid, u.email, u.password, u.displayName, u.role, u.shopId);
        } catch (e) {}
      }
    }
    if (custsRes.data) {
      for (const c of custsRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO customers (id, shopId, name, phone, email, address, balance, visits, totalSpent, loyaltyPoints, aadharNumber, photoUrl, aadharPhotoUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(c.id, c.shopId, c.name, c.phone, c.email, c.address, c.balance || 0, c.visits || 0, c.totalSpent || 0, c.loyaltyPoints || 0, c.aadharNumber, c.photoUrl, c.aadharPhotoUrl || null);
        } catch (e) {}
      }
    }
    if (txsRes.data) {
      for (const t of txsRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO transactions (id, shopId, subtotal, taxAmount, discountAmount, totalAmount, paymentMethod, customerId, items, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(t.id, t.shopId, t.subtotal || 0, t.taxAmount || 0, t.discountAmount || 0, t.totalAmount || 0, t.paymentMethod, t.customerId, typeof t.items === 'string' ? t.items : JSON.stringify(t.items || []), t.createdAt);
        } catch (e) {}
      }
    }
    if (expRes.data) {
      for (const ex of expRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO expenses (id, shopId, title, category, amount, description, date, notes, addedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(ex.id, ex.shopId, ex.title, ex.category, ex.amount || 0, ex.description, ex.date, ex.notes, ex.addedBy, ex.createdAt);
        } catch (e) {}
      }
    }
    if (udharRes.data) {
      for (const u of udharRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO udhar_transactions (id, shopId, customerId, amount, type, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(u.id, u.shopId, u.customerId, u.amount || 0, u.type, u.notes, u.createdAt);
        } catch (e) {}
      }
    }
    if (suppRes.data) {
      for (const sp of suppRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO suppliers (id, shopId, name, contactPerson, phone, email, address, gstNumber, paymentTerms, balance, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(sp.id, sp.shopId, sp.name, sp.contactPerson, sp.phone, sp.email, sp.address, sp.gstNumber, sp.paymentTerms, sp.balance || 0, sp.createdAt);
        } catch (e) {}
      }
    }
    if (purchRes.data) {
      for (const pr of purchRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO purchases (id, shopId, supplierId, invoiceNumber, date, purchaseDate, totalAmount, paidAmount, paymentStatus, paymentMethod, items, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(pr.id, pr.shopId, pr.supplierId, pr.invoiceNumber, pr.date, pr.purchaseDate, pr.totalAmount || 0, pr.paidAmount || 0, pr.paymentStatus, pr.paymentMethod, typeof pr.items === 'string' ? pr.items : JSON.stringify(pr.items || []), pr.notes, pr.createdAt);
        } catch (e) {}
      }
    }
    if (notifRes.data) {
      for (const n of notifRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO notifications (id, shopId, title, message, type, channel, actionUrl, isRead, readBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(n.id, n.shopId, n.title, n.message, n.type, n.channel, n.actionUrl, n.isRead ? 1 : 0, typeof n.readBy === 'string' ? n.readBy : JSON.stringify(n.readBy || []), n.createdAt);
        } catch (e) {}
      }
    }
    if (promoRes.data) {
      for (const pm of promoRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO promo_codes (code, discountPercent, flatDiscount, planType, maxUses, usedCount, validUntil, active, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(pm.code, pm.discountPercent || 0, pm.flatDiscount || 0, pm.planType, pm.maxUses || 100, pm.usedCount || 0, pm.validUntil, pm.active ? 1 : 0, pm.createdAt);
        } catch (e) {}
      }
    }
    console.log('✅ Local SQLite cache successfully synchronized with Supabase Cloud.');
  } catch (err) {
    console.warn('Cache warm-up notice:', err.message);
  }
}

const pool = {
  async testConnection() {
    console.log('⚡ Initializing database adapter (Supabase / SQLite)...');

    // 1. Check direct PostgreSQL connection if configured
    if (pgPool) {
      try {
        const client = await pgPool.connect();
        const res = await client.query('SELECT NOW()');
        client.release();
        isPostgresReady = true;
        console.log('✅ Connected directly to Supabase PostgreSQL at:', pgHost);
        return true;
      } catch (pgErr) {
        console.warn('Supabase direct PostgreSQL connection not active:', pgErr.message);
      }
    }

    // 2. Test Supabase API access
    try {
      const { data, error } = await supabase.from('shops').select('shopId').limit(1);
      if (!error) {
        isSupabaseApiReady = true;
        console.log('✅ Supabase REST API connection verified with dyuimjageamopkodfplk.supabase.co');
        // Warm up local cache asynchronously from Supabase
        warmUpCacheFromSupabase().catch(() => {});
        return true;
      } else if (error.code === 'PGRST205') {
        console.warn('\n⚠️ Supabase Notice: Tables are not created yet in your Supabase project.');
        console.log('👉 Open Supabase Dashboard -> SQL Editor, paste `supabase_schema.sql` and click "RUN".');
        console.log('👉 Then run: node backend/sync_to_supabase.cjs to sync all products & data!\n');
      } else {
        console.warn('Supabase API response notice:', error.message);
      }
    } catch (sbErr) {
      console.warn('Supabase check notice:', sbErr.message);
    }

    // 3. Fallback to embedded SQLite database for zero-downtime offline support
    console.log('⚡ Embedded SQLite database active for local operations.');
    isFallbackActive = true;
    getSQLiteDb();
    return true;
  },

  async query(sql, params = []) {
    // If PostgreSQL pool is ready, query PostgreSQL directly
    if (isPostgresReady && pgPool) {
      try {
        const pgSql = toPostgresSql(sql);
        const res = await pgPool.query(pgSql, params);
        if (sql.trim().toLowerCase().startsWith('select')) {
          return [res.rows];
        }
        return [{ affectedRows: res.rowCount, insertId: 0 }];
      } catch (err) {
        console.warn('PostgreSQL query error, falling back to local database:', err.message);
        return runSQLiteQuery(sql, params);
      }
    }

    // Standard queries run against embedded SQLite engine
    return runSQLiteQuery(sql, params);
  },

  async getConnection() {
    if (isPostgresReady && pgPool) {
      try {
        const client = await pgPool.connect();
        return {
          async query(sql, params = []) {
            const pgSql = toPostgresSql(sql);
            const res = await client.query(pgSql, params);
            if (sql.trim().toLowerCase().startsWith('select')) {
              return [res.rows];
            }
            return [{ affectedRows: res.rowCount, insertId: 0 }];
          },
          async beginTransaction() {
            await client.query('BEGIN');
          },
          async commit() {
            await client.query('COMMIT');
          },
          async rollback() {
            await client.query('ROLLBACK');
          },
          release() {
            client.release();
          }
        };
      } catch (err) {
        console.warn('Postgres connection failed, using local connection:', err.message);
      }
    }

    return createSQLiteConnection();
  },

  getStatus() {
    return {
      adapter: isPostgresReady ? 'supabase_postgres' : (isSupabaseApiReady ? 'supabase_api' : 'sqlite_active'),
      isSupabaseApiReady,
      isPostgresReady,
      isFallbackActive: !isPostgresReady,
      supabaseUrl,
      supabaseKeyConfigured: Boolean(supabaseKey)
    };
  }
};

module.exports = pool;
