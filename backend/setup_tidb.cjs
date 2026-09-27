const mysql = require('mysql2/promise');

async function initTiDBSchema() {
  console.log('Connecting to TiDB Cloud gateway...');
  const conn = await mysql.createConnection({
    host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: 'Q6jneq1m3b8AAAP.root',
    password: 'kPfHD6VZ6LWtSsi3',
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connected! Creating database nayashi_kirana if not exists...');
  await conn.query('CREATE DATABASE IF NOT EXISTS nayashi_kirana');
  await conn.query('USE nayashi_kirana');

  console.log('Creating shops table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS shops (
      shopId VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      ownerName VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      email VARCHAR(255),
      address TEXT,
      gstNumber VARCHAR(50),
      upiId VARCHAR(255),
      publicUrl VARCHAR(255),
      plan VARCHAR(20) DEFAULT 'free',
      planExpiry DATETIME,
      settings JSON,
      receiptHeader TEXT,
      receiptFooter TEXT,
      receiptPaperSize VARCHAR(20) DEFAULT 'thermal',
      fssaiNumber VARCHAR(50),
      invoiceTerms TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Creating users table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      uid VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255),
      displayName VARCHAR(255),
      role VARCHAR(20) DEFAULT 'staff',
      shopId VARCHAR(255),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE SET NULL
    )
  `);

  console.log('Creating products table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(255) PRIMARY KEY,
      shopId VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      brand VARCHAR(100),
      unit VARCHAR(50),
      purchasePrice DECIMAL(10, 2),
      sellingPrice DECIMAL(10, 2),
      mrp DECIMAL(10, 2),
      gst DECIMAL(5, 2),
      stock DECIMAL(10, 2),
      minStock DECIMAL(10, 2),
      sku VARCHAR(100),
      barcode VARCHAR(255),
      shortCode VARCHAR(100),
      isLoose TINYINT(1) DEFAULT 0,
      expiryDate DATE,
      imageUrl LONGTEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE
    )
  `);

  console.log('Creating customers table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(255) PRIMARY KEY,
      shopId VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      address TEXT,
      balance DECIMAL(10, 2) DEFAULT 0,
      visits INT DEFAULT 0,
      totalSpent DECIMAL(10, 2) DEFAULT 0,
      loyaltyPoints INT DEFAULT 0,
      aadharNumber VARCHAR(20),
      photoUrl LONGTEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE
    )
  `);

  console.log('Creating transactions table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(255) PRIMARY KEY,
      shopId VARCHAR(255),
      subtotal DECIMAL(10, 2),
      taxAmount DECIMAL(10, 2),
      discountAmount DECIMAL(10, 2),
      totalAmount DECIMAL(10, 2),
      paymentMethod VARCHAR(50),
      customerId VARCHAR(255),
      items JSON,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE,
      FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
    )
  `);

  console.log('Creating expenses table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(255) PRIMARY KEY,
      shopId VARCHAR(255),
      title VARCHAR(255),
      category VARCHAR(100),
      amount DECIMAL(10, 2),
      description TEXT,
      date DATETIME,
      notes TEXT,
      addedBy VARCHAR(255),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE
    )
  `);

  console.log('Creating udhar_transactions table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS udhar_transactions (
      id VARCHAR(255) PRIMARY KEY,
      shopId VARCHAR(255),
      customerId VARCHAR(255),
      amount DECIMAL(10, 2),
      type VARCHAR(20),
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE,
      FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);

  console.log('Creating suppliers table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id VARCHAR(255) PRIMARY KEY,
      shopId VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      contactPerson VARCHAR(255),
      phone VARCHAR(20),
      email VARCHAR(255),
      address TEXT,
      gstNumber VARCHAR(50),
      paymentTerms VARCHAR(100),
      balance DECIMAL(10, 2) DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE
    )
  `);

  console.log('Creating purchases table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS purchases (
      id VARCHAR(255) PRIMARY KEY,
      shopId VARCHAR(255) NOT NULL,
      supplierId VARCHAR(255),
      invoiceNumber VARCHAR(100),
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      purchaseDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      totalAmount DECIMAL(10, 2) NOT NULL DEFAULT 0,
      paidAmount DECIMAL(10, 2) NOT NULL DEFAULT 0,
      paymentStatus VARCHAR(20) DEFAULT 'paid',
      paymentMethod VARCHAR(50),
      items JSON,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE,
      FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL
    )
  `);

  console.log('==============================================');
  console.log('🎉 ALL TABLES CREATED SUCCESSFULLY ON TIDB CLOUD!');
  const [tables] = await conn.query('SHOW TABLES');
  console.log('Tables in nayashi_kirana:');
  console.table(tables.map(t => Object.values(t)[0]));
  console.log('==============================================');

  await conn.end();
}

initTiDBSchema().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
