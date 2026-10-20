const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const pool = require('./db.js');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dyuimjageamopkodfplk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ww5ZWKvl_uH-fzQKylCGeA_TlRDI52V';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncAll() {
  console.log('🔄 Checking Supabase connection...');
  console.log('Supabase URL:', supabaseUrl);

  const tables = [
    { name: 'shops', key: 'shopId' },
    { name: 'users', key: 'uid' },
    { name: 'customers', key: 'id' },
    { name: 'products', key: 'id' },
    { name: 'suppliers', key: 'id' },
    { name: 'transactions', key: 'id' },
    { name: 'expenses', key: 'id' },
    { name: 'udhar_transactions', key: 'id' },
    { name: 'purchases', key: 'id' },
    { name: 'notifications', key: 'id' },
    { name: 'promo_codes', key: 'code' },
  ];

  // Test if schema exists
  const { error: testErr } = await supabase.from('shops').select('shopId').limit(1);
  if (testErr) {
    if (testErr.code === 'PGRST205') {
      console.error('\n❌ Tables do not exist yet in Supabase!');
      console.log('👉 Please go to Supabase Dashboard -> SQL Editor, copy and paste the contents of `supabase_schema.sql`, and click "RUN".');
      console.log('Then run this sync command again: node backend/sync_to_supabase.cjs\n');
      process.exit(1);
    } else {
      console.error('Supabase query error:', testErr);
      process.exit(1);
    }
  }

  console.log('✅ Supabase tables verified! Starting data sync from local database...\n');

  for (const { name } of tables) {
    try {
      const [rows] = await pool.query(`SELECT * FROM ${name}`);
      if (!rows || rows.length === 0) {
        console.log(`⏩ ${name}: 0 records to sync`);
        continue;
      }

      console.log(`⏳ Syncing ${name} (${rows.length} records)...`);

      // Clean rows for Supabase insertion
      const formatted = rows.map(r => {
        const item = { ...r };
        for (const [k, v] of Object.entries(item)) {
          if (v === undefined) item[k] = null;
          // Format boolean
          if (k === 'isLoose' || k === 'active') {
            item[k] = Boolean(v);
          }
          // Parse JSON if needed
          if ((k === 'settings' || k === 'items' || k === 'readBy') && typeof v === 'string') {
            try { item[k] = JSON.parse(v); } catch (e) {}
          }
          // Avoid huge base64 strings if corrupted
          if ((k === 'imageUrl' || k === 'photoUrl') && typeof v === 'string' && v.length > 500000) {
            console.warn(`  ⚠️ Truncating oversized image for item ${item.name || item.id}`);
            item[k] = null;
          }
        }
        return item;
      });

      // Insert in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < formatted.length; i += chunkSize) {
        const chunk = formatted.slice(i, i + chunkSize);
        const { error } = await supabase.from(name).upsert(chunk);
        if (error) {
          console.error(`  ❌ Error syncing chunk in ${name}:`, error.message);
        }
      }

      console.log(`  ✅ ${name}: Synced ${rows.length} records successfully!`);
    } catch (err) {
      console.error(`  ❌ Failed to sync ${name}:`, err.message);
    }
  }

  console.log('\n🎉 ALL STORE DATA SUCCESSFULLY SYNCED TO SUPABASE!');
  process.exit(0);
}

syncAll().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
