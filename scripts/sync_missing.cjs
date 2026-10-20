const fs = require('fs');
const { supabase } = require('../backend/supabase.js');

async function syncMissing() {
  console.log('Reading migration file...');
  const content = fs.readFileSync('supabase_migration.sql', 'utf8');
  const lines = content.split('\n');

  // 1. Sync Customers
  const customerLines = lines.filter(l => l.startsWith('INSERT INTO customers '));
  console.log(`Found ${customerLines.length} customer lines`);
  for (const line of customerLines) {
    const colMatch = line.match(/INSERT INTO customers \((.+?)\) VALUES/);
    const valMatch = line.match(/VALUES \((.+)\) ON CONFLICT/);
    if (!colMatch || !valMatch) continue;

    const cols = colMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
    // Split values respecting single quotes
    const vals = valMatch[1].split(/,\s*(?=(?:[^']*'[^']*')*[^']*$)/).map(v => {
      const trimmed = v.trim();
      if (trimmed === 'NULL') return null;
      return trimmed.replace(/^'|'$/g, '').replace(/''/g, "'");
    });

    const obj = {};
    cols.forEach((col, idx) => {
      if (col === 'aadharPhotoUrl') return; // Skip extra column
      let val = vals[idx];
      if (col === 'balance' || col === 'totalSpent') val = parseFloat(val) || 0;
      if (col === 'visits' || col === 'loyaltyPoints') val = parseInt(val) || 0;
      if (col === 'photoUrl' && val && val.length > 500000) val = null;
      obj[col] = val;
    });

    const { error } = await supabase.from('customers').upsert(obj);
    if (error) console.error('Error customer:', obj.name, error.message);
  }

  const { count: custCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
  console.log(`✅ Customers in Supabase: ${custCount}`);

  // 2. Sync Transactions
  const txLines = lines.filter(l => l.startsWith('INSERT INTO transactions '));
  console.log(`Found ${txLines.length} transaction lines`);
  for (const line of txLines) {
    const colMatch = line.match(/INSERT INTO transactions \((.+?)\) VALUES/);
    const valMatch = line.match(/VALUES \((.+)\) ON CONFLICT/);
    if (!colMatch || !valMatch) continue;

    const cols = colMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
    const vals = valMatch[1].split(/,\s*(?=(?:[^']*'[^']*')*[^']*$)/).map(v => {
      const trimmed = v.trim();
      if (trimmed === 'NULL') return null;
      return trimmed.replace(/^'|'$/g, '').replace(/''/g, "'");
    });

    const obj = {};
    cols.forEach((col, idx) => {
      let val = vals[idx];
      if (col === 'subtotal' || col === 'taxAmount' || col === 'discountAmount' || col === 'totalAmount') {
        val = parseFloat(val) || 0;
      }
      if (col === 'items' && typeof val === 'string') {
        try { val = JSON.parse(val); } catch (e) {}
      }
      obj[col] = val;
    });

    const { error } = await supabase.from('transactions').upsert(obj);
    if (error) console.error('Error transaction:', obj.id, error.message);
  }

  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  console.log(`✅ Transactions in Supabase: ${txCount}`);

  // 3. Sync Udhar Transactions
  const udharLines = lines.filter(l => l.startsWith('INSERT INTO udhar_transactions '));
  console.log(`Found ${udharLines.length} udhar lines`);
  for (const line of udharLines) {
    const colMatch = line.match(/INSERT INTO udhar_transactions \((.+?)\) VALUES/);
    const valMatch = line.match(/VALUES \((.+)\) ON CONFLICT/);
    if (!colMatch || !valMatch) continue;

    const cols = colMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
    const vals = valMatch[1].split(/,\s*(?=(?:[^']*'[^']*')*[^']*$)/).map(v => {
      const trimmed = v.trim();
      if (trimmed === 'NULL') return null;
      return trimmed.replace(/^'|'$/g, '').replace(/''/g, "'");
    });

    const obj = {};
    cols.forEach((col, idx) => {
      let val = vals[idx];
      if (col === 'amount') val = parseFloat(val) || 0;
      obj[col] = val;
    });

    const { error } = await supabase.from('udhar_transactions').upsert(obj);
    if (error) console.error('Error udhar:', obj.id, error.message);
  }

  const { count: udharCount } = await supabase.from('udhar_transactions').select('*', { count: 'exact', head: true });
  console.log(`✅ Udhar transactions in Supabase: ${udharCount}`);

  process.exit(0);
}

syncMissing().catch(e => {
  console.error(e);
  process.exit(1);
});
