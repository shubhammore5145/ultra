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
  const dataDir = isVercel ? '/tmp/kirana-data' : path.join(__dirname, 'data');
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
        shortCode TEXT,
        isLoose INTEGER DEFAULT 0,
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
    `);

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
  promo_codes: 'code'
};

async function syncMutationToSupabase(sql, params = []) {
  if (!isSupabaseApiReady) return;
  const trimmed = sql.trim();
  const lower = trimmed.toLowerCase();

  try {
    // 1. DELETE
    if (lower.startsWith('delete from')) {
      const match = trimmed.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)\s+WHERE\s+(.+)/i);
      if (match) {
        const table = match[1].toLowerCase();
        const pk = TABLE_PRIMARY_KEYS[table] || 'id';
        const id = params[0];
        if (id) {
          await supabase.from(table).delete().eq(pk, id);
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
          if (col === 'isLoose' || col === 'active') val = Boolean(val);
          if ((col === 'settings' || col === 'items' || col === 'readBy') && typeof val === 'string') {
            try { val = JSON.parse(val); } catch (e) {}
          }
          if ((col === 'imageUrl' || col === 'photoUrl') && typeof val === 'string' && val.length > 500000) {
            val = null;
          }
          row[col] = val;
        });
        await supabase.from(table).upsert(row);
      }
      return;
    }

    // 3. UPDATE
    if (lower.startsWith('update')) {
      const match = trimmed.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+/i);
      if (match) {
        const table = match[1].toLowerCase();
        const pk = TABLE_PRIMARY_KEYS[table] || 'id';
        const lastParam = params[params.length - 1];
        if (lastParam) {
          const db = getSQLiteDb();
          const stmt = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`);
          const row = stmt.get(lastParam);
          if (row) {
            const formatted = { ...row };
            for (const [k, v] of Object.entries(formatted)) {
              if (k === 'isLoose' || k === 'active') formatted[k] = Boolean(v);
              if ((k === 'settings' || k === 'items' || k === 'readBy') && typeof v === 'string') {
                try { formatted[k] = JSON.parse(v); } catch (e) {}
              }
              if ((k === 'imageUrl' || k === 'photoUrl') && typeof v === 'string' && v.length > 500000) {
                formatted[k] = null;
              }
            }
            await supabase.from(table).upsert(formatted);
          }
        }
      }
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
    const countCheck = db.prepare('SELECT count(*) as c FROM products').get();
    if (countCheck && countCheck.c > 0) return; // Cache already populated

    const [shopsRes, prodsRes, usersRes, custsRes] = await Promise.all([
      supabase.from('shops').select('*'),
      supabase.from('products').select('*'),
      supabase.from('users').select('*'),
      supabase.from('customers').select('*')
    ]);

    if (shopsRes.data) {
      for (const s of shopsRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO shops (shopId, name, ownerName, phone, email, address, gstNumber, upiId, publicUrl, plan, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(s.shopId, s.name, s.ownerName, s.phone, s.email, s.address, s.gstNumber, s.upiId, s.publicUrl, s.plan, JSON.stringify(s.settings || {}));
        } catch (e) {}
      }
    }
    if (prodsRes.data) {
      for (const p of prodsRes.data) {
        try {
          db.prepare('INSERT OR REPLACE INTO products (id, shopId, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, shortCode, isLoose, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(p.id, p.shopId, p.name, p.category, p.brand, p.unit, p.purchasePrice, p.sellingPrice, p.mrp, p.gst, p.stock, p.minStock, p.sku, p.barcode, p.shortCode, p.isLoose ? 1 : 0, p.imageUrl);
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
          db.prepare('INSERT OR REPLACE INTO customers (id, shopId, name, phone, email, address, balance, visits, totalSpent, loyaltyPoints, aadharNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(c.id, c.shopId, c.name, c.phone, c.email, c.address, c.balance, c.visits, c.totalSpent, c.loyaltyPoints, c.aadharNumber);
        } catch (e) {}
      }
    }
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
