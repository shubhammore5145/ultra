/**
 * sync_sqlite_to_supabase.cjs
 * ----------------------------
 * One-shot script: reads ALL data from local SQLite → pushes to Supabase.
 * Run once to migrate existing local data, then all future writes auto-sync
 * via the syncMutationToSupabase hook inside backend/db.js.
 *
 * Usage:  node scripts/sync_sqlite_to_supabase.cjs
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const { DatabaseSync } = require('node:sqlite');

// ── Supabase credentials ──────────────────────────────────────────────────────
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://dyuimjageamopkodfplk.supabase.co';

const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_KEY ||
  'sb_publishable_ww5ZWKvl_uH-fzQKylCGeA_TlRDI52V';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── SQLite path ───────────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, '..', 'backend', 'data', 'kirana.db');
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ SQLite DB not found at:', DB_PATH);
  process.exit(1);
}
const db = new DatabaseSync(DB_PATH);

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseJson(val) {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

function cleanRow(table, row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    let val = v;

    // JSON columns
    if (['items', 'settings', 'readBy'].includes(k) && typeof val === 'string') {
      val = parseJson(val);
    }

    // Boolean columns
    if (['isLoose', 'active'].includes(k)) {
      val = Boolean(val);
    }

    // isDeleted stays as int (0/1)
    if (k === 'isDeleted') {
      val = val ? 1 : 0;
    }

    // Strip base64 images > 500 KB to avoid payload limits
    if (['imageUrl', 'photoUrl', 'aadharPhotoUrl'].includes(k) && typeof val === 'string' && val.length > 500000) {
      val = null;
    }

    // Empty-string date → null
    if (['expiryDate', 'date', 'purchaseDate', 'validUntil', 'planExpiry', 'deletedAt'].includes(k) && (!val || val === '')) {
      val = null;
    }

    out[k] = val;
  }
  return out;
}

async function upsertTable(table, pkField) {
  let rows;
  try {
    rows = db.prepare(`SELECT * FROM ${table}`).all();
  } catch (e) {
    console.warn(`  ⚠️  Table "${table}" not found in SQLite — skipping.`);
    return { skipped: true };
  }

  if (!rows || rows.length === 0) {
    console.log(`  ℹ️  ${table}: 0 rows — nothing to sync.`);
    return { count: 0 };
  }

  const BATCH = 50;
  let synced = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => cleanRow(table, r));
    const { error } = await supabase.from(table).upsert(batch, { onConflict: pkField });
    if (error) {
      console.error(`  ❌ ${table} batch [${i}–${i + batch.length}] error:`, error.message);
      errors += batch.length;
    } else {
      synced += batch.length;
    }
  }

  console.log(`  ✅ ${table}: ${synced} rows synced${errors ? `, ${errors} errors` : ''}.`);
  return { count: synced, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 Nayashi Kirana – SQLite → Supabase Sync\n');
  console.log('  Supabase:', SUPABASE_URL);
  console.log('  SQLite  :', DB_PATH, '\n');

  // Test Supabase connectivity
  const { data, error: connErr } = await supabase.from('shops').select('shopId').limit(1);
  if (connErr && connErr.code !== 'PGRST205') {
    console.error('❌ Cannot connect to Supabase:', connErr.message);
    console.error('   Check your internet connection and Supabase keys.');
    process.exit(1);
  }

  if (connErr && connErr.code === 'PGRST205') {
    console.warn('⚠️  Supabase tables not found (PGRST205).');
    console.warn('   Please run "supabase_schema.sql" in Supabase SQL Editor first.');
    console.warn('   File: c:\\Users\\shubh\\Desktop\\Nayashi kirana\\supabase_schema.sql\n');
    process.exit(1);
  }

  console.log('✅ Supabase connection OK\n');
  console.log('📦 Starting table sync...\n');

  // Sync in dependency order (parent tables first)
  await upsertTable('shops',               'shopId');
  await upsertTable('users',               'uid');
  await upsertTable('products',            'id');
  await upsertTable('customers',           'id');
  await upsertTable('transactions',        'id');
  await upsertTable('expenses',            'id');
  await upsertTable('udhar_transactions',  'id');
  await upsertTable('suppliers',           'id');
  await upsertTable('purchases',           'id');
  await upsertTable('staff',               'id');
  await upsertTable('staff_attendance',    'id');
  await upsertTable('staff_salary_payments', 'id');
  await upsertTable('notifications',       'id');
  await upsertTable('promo_codes',         'code');

  console.log('\n🎉 Sync complete!\n');
  console.log('Next steps:');
  console.log('  1. Open your live site — data should now appear.');
  console.log('  2. Future writes auto-sync via backend/db.js → syncMutationToSupabase().');
  console.log('  3. Set DATABASE_URL in Vercel env vars to use Supabase Postgres directly (optional).\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
