const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function migrate() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Connected to MySQL database.');

    // 1. Add publicUrl column to shops if not exists
    try {
      await conn.query('ALTER TABLE shops ADD COLUMN publicUrl VARCHAR(255)');
      console.log('Added publicUrl column to shops table.');
    } catch(e) {
      console.log('publicUrl note:', e.message);
    }

    // 2. Create suppliers table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(255) PRIMARY KEY,
        shopId VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        gstNumber VARCHAR(50),
        balance DECIMAL(10,2) DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE
      )
    `);
    console.log('Suppliers table ready.');

    // 3. Create purchases table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id VARCHAR(255) PRIMARY KEY,
        shopId VARCHAR(255) NOT NULL,
        supplierId VARCHAR(255),
        invoiceNumber VARCHAR(100),
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        totalAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
        paidAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
        paymentStatus VARCHAR(20) DEFAULT 'paid',
        items JSON,
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE,
        FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL
      )
    `);
    console.log('Purchases table ready.');

    await conn.end();
    console.log('All migrations completed successfully!');
  } catch(err) {
    console.error('Migration error:', err);
  }
}

migrate();
