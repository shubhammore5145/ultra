const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function syncLocalToTiDB() {
  console.log('Connecting to local MySQL...');
  const localConn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'Shubham16@',
    database: 'nayashi_kirana'
  });

  console.log('Connecting to TiDB Cloud...');
  const tidbConn = await mysql.createConnection({
    host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: 'Q6jneq1m3b8AAAP.root',
    password: 'kPfHD6VZ6LWtSsi3',
    database: 'nayashi_kirana',
    ssl: { rejectUnauthorized: false }
  });

  // 1. Copy shops
  const [shops] = await localConn.query('SELECT * FROM shops');
  console.log(`Copying ${shops.length} shops...`);
  for (const s of shops) {
    await tidbConn.query(
      `INSERT IGNORE INTO shops (shopId, name, ownerName, phone, email, address, gstNumber, upiId, publicUrl, plan, planExpiry, settings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.shopId, s.name, s.ownerName, s.phone, s.email, s.address, s.gstNumber, s.upiId, s.publicUrl, s.plan, s.planExpiry, s.settings ? JSON.stringify(s.settings) : null]
    );
  }

  // 2. Copy users
  const [users] = await localConn.query('SELECT * FROM users');
  console.log(`Copying ${users.length} users...`);
  for (const u of users) {
    await tidbConn.query(
      `INSERT IGNORE INTO users (uid, email, password, displayName, role, shopId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [u.uid, u.email, u.password, u.displayName, u.role, u.shopId]
    );
  }

  // 3. Copy products
  const [products] = await localConn.query('SELECT * FROM products');
  console.log(`Copying ${products.length} products...`);
  for (const p of products) {
    await tidbConn.query(
      `INSERT IGNORE INTO products (id, shopId, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, shortCode, isLoose, expiryDate, imageUrl)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.shopId, p.name, p.category, p.brand, p.unit, p.purchasePrice, p.sellingPrice, p.mrp, p.gst, p.stock, p.minStock, p.sku, p.barcode, p.shortCode, p.isLoose, p.expiryDate, p.imageUrl]
    );
  }

  // 4. Copy customers
  const [customers] = await localConn.query('SELECT * FROM customers');
  console.log(`Copying ${customers.length} customers...`);
  for (const c of customers) {
    await tidbConn.query(
      `INSERT IGNORE INTO customers (id, shopId, name, phone, address, balance, visits, totalSpent, loyaltyPoints, aadharNumber, photoUrl)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.shopId, c.name, c.phone, c.address, c.balance, c.visits, c.totalSpent, c.loyaltyPoints, c.aadharNumber, c.photoUrl]
    );
  }

  console.log('✅ Local data successfully copied to TiDB Cloud!');
  await localConn.end();
  await tidbConn.end();
}

syncLocalToTiDB().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
