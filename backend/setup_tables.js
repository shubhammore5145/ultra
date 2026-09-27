const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function setupTables() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Shubham16@',
      database: process.env.DB_NAME || 'nayashi_kirana'
    });

    console.log("Connected to MySQL database...");

    // Shops Table
    await connection.execute(`
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
        settings JSON
      )
    `);

    // Users Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        uid VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255),
        displayName VARCHAR(255),
        role VARCHAR(20) DEFAULT 'staff',
        shopId VARCHAR(255),
        FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE SET NULL
      )
    `);

    // Products Table
    await connection.execute(`
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
        expiryDate DATE,
        imageUrl LONGTEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE
      )
    `);

    // Customers Table
    await connection.execute(`
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

    // Transactions Table
    await connection.execute(`
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

    // Expenses Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(255) PRIMARY KEY,
        shopId VARCHAR(255),
        category VARCHAR(100),
        amount DECIMAL(10, 2),
        description TEXT,
        date DATETIME,
        addedBy VARCHAR(255),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE
      )
    `);

    // Udhar Transactions Table
    await connection.execute(`
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

    // Suppliers Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(255) PRIMARY KEY,
        shopId VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        gstNumber VARCHAR(50),
        balance DECIMAL(10, 2) DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE
      )
    `);

    // Purchases Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchases (
        id VARCHAR(255) PRIMARY KEY,
        shopId VARCHAR(255) NOT NULL,
        supplierId VARCHAR(255),
        invoiceNumber VARCHAR(100),
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        totalAmount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        paidAmount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        paymentStatus VARCHAR(20) DEFAULT 'paid',
        items JSON,
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shopId) REFERENCES shops(shopId) ON DELETE CASCADE,
        FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL
      )
    `);

    console.log("All tables verified and created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error creating tables:", error);
    process.exit(1);
  }
}

setupTables();
