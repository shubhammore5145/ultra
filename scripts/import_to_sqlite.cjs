const fs = require('fs');
const pool = require('../backend/db.js');

async function importData() {
  await pool.testConnection();
  const content = fs.readFileSync('supabase_migration.sql', 'utf8');
  const lines = content.split('\n');
  let inserted = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line.startsWith('INSERT INTO')) continue;
    line = line.replace('ON CONFLICT DO NOTHING;', ';');
    line = line.replace(/"/g, '');
    line = line.replace(/::jsonb/g, '');

    try {
      await pool.query(line);
      inserted++;
    } catch (e) {
      // Ignore duplicates
    }
  }

  console.log('Successfully imported', inserted, 'records into local database!');
  const [p] = await pool.query('SELECT count(*) as count FROM products');
  const [s] = await pool.query('SELECT count(*) as count FROM shops');
  const [u] = await pool.query('SELECT count(*) as count FROM users');
  console.log({ products: p[0], shops: s[0], users: u[0] });
  process.exit(0);
}

importData().catch(err => {
  console.error(err);
  process.exit(1);
});
