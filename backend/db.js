const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

let poolConfig = {};

if (process.env.DATABASE_URL) {
  poolConfig = {
    uri: process.env.DATABASE_URL
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'Shubham16@',
    database: process.env.DB_NAME || 'nayashi_kirana',
    connectTimeout: 15000,
  };
}

// Enable SSL for cloud databases (TiDB, Aiven, Railway, AWS RDS, etc.)
if (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1')) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

poolConfig.waitForConnections = true;
poolConfig.connectionLimit = 10;
poolConfig.queueLimit = 0;

let mysqlPool = null;
try {
  mysqlPool = mysql.createPool(poolConfig);
} catch (e) {
  console.warn('MySQL pool initialization error:', e.message);
}

let isMySQLReady = false;
let isFallbackActive = false;
let sqliteDb = null;

// Initialize embedded SQLite database when cloud MySQL is unreachable
function getSQLiteDb() {
  if (sqliteDb) return sqliteDb;

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'kirana.db');

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
        expiryDate TEXT,
        imageUrl TEXT,
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
    `);

    // Run non-destructive column migrations for SQLite
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN shortCode TEXT;'); } catch (e) {}
    try { sqliteDb.exec('ALTER TABLE products ADD COLUMN isLoose INTEGER DEFAULT 0;'); } catch (e) {}

    console.log('⚡ Embedded SQLite database ready at:', dbPath);
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
    return [{ affectedRows: res.changes, insertId: Number(res.lastInsertRowid) }];
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
    release() {
      // No external connection to release
    }
  };
}

const pool = {
  async testConnection() {
    if (process.env.DB_ADAPTER === 'sqlite') {
      console.log('⚡ DB_ADAPTER=sqlite specified. Using embedded SQLite database.');
      isFallbackActive = true;
      getSQLiteDb();
      return true;
    }

    try {
      if (!mysqlPool) throw new Error('MySQL pool not initialized');
      const conn = await mysqlPool.getConnection();
      console.log(`Connected to MySQL database [${process.env.DB_NAME || 'nayashi_kirana'}] on [${process.env.DB_HOST || 'localhost'}]`);
      
      // Auto-migrate products columns if needed
      try { await conn.query('ALTER TABLE products ADD COLUMN shortCode VARCHAR(100)'); } catch (e) {}
      try { await conn.query('ALTER TABLE products ADD COLUMN isLoose TINYINT(1) DEFAULT 0'); } catch (e) {}

      conn.release();
      isMySQLReady = true;
      return true;
    } catch (err) {
      console.warn(`MySQL connection unavailable (${err.code || err.message}). Switching automatically to embedded SQLite fallback database.`);
      isFallbackActive = true;
      getSQLiteDb();
      return false;
    }
  },

  async query(sql, params) {
    if (isFallbackActive) {
      return runSQLiteQuery(sql, params);
    }

    if (isMySQLReady && mysqlPool) {
      try {
        return await mysqlPool.query(sql, params);
      } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.warn(`MySQL connection dropped (${err.code}). Auto-switching to embedded SQLite.`);
          isFallbackActive = true;
          isMySQLReady = false;
          return runSQLiteQuery(sql, params);
        }
        throw err;
      }
    }

    // Undetermined state: try MySQL first
    try {
      if (!mysqlPool) throw new Error('No MySQL pool');
      const res = await mysqlPool.query(sql, params);
      isMySQLReady = true;
      return res;
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || (err.message && err.message.includes('ECONNREFUSED'))) {
        console.warn(`MySQL connection failed (${err.code || err.message}). Auto-switching to embedded SQLite.`);
        isFallbackActive = true;
        isMySQLReady = false;
        return runSQLiteQuery(sql, params);
      }
      throw err;
    }
  },

  async getConnection() {
    if (isFallbackActive) {
      return createSQLiteConnection();
    }

    if (isMySQLReady && mysqlPool) {
      try {
        return await mysqlPool.getConnection();
      } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          console.warn(`MySQL getConnection lost (${err.code}). Switching to SQLite connection.`);
          isFallbackActive = true;
          isMySQLReady = false;
          return createSQLiteConnection();
        }
        throw err;
      }
    }

    try {
      if (!mysqlPool) throw new Error('No MySQL pool');
      const conn = await mysqlPool.getConnection();
      isMySQLReady = true;
      return conn;
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
        console.warn(`MySQL getConnection failed (${err.code || err.message}). Switching to SQLite connection.`);
        isFallbackActive = true;
        isMySQLReady = false;
        return createSQLiteConnection();
      }
      throw err;
    }
  }
};

module.exports = pool;
