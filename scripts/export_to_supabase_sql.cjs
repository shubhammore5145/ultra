const fs = require('fs');
const path = require('path');
const pool = require('../backend/db.js');

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : val.toString();
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'`;
  }
  return `'${val.toString().replace(/'/g, "''")}'`;
}

async function exportToSupabase() {
  console.log('Generating Supabase PostgreSQL migration script...');

  let sql = `-- ==========================================================
-- SUPABASE MIGRATION SCRIPT FOR NAYASHI KIRANA / MARTGPT
-- Project: https://dyuimjageamopkodfplk.supabase.co
-- Generated automatically with all tables, schema, and current data
-- ==========================================================

-- 1. DROP EXISTING CONFLICTING TABLES (Optional/Clean start)
-- DROP TABLE IF EXISTS promo_codes CASCADE;
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS purchases CASCADE;
-- DROP TABLE IF EXISTS suppliers CASCADE;
-- DROP TABLE IF EXISTS udhar_transactions CASCADE;
-- DROP TABLE IF EXISTS expenses CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS customers CASCADE;
-- DROP TABLE IF EXISTS products CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS shops CASCADE;

-- ==========================================================
-- 2. CREATE TABLES
-- ==========================================================

-- Shops Table
CREATE TABLE IF NOT EXISTS shops (
  "shopId" TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  "gstNumber" TEXT,
  "upiId" TEXT,
  "publicUrl" TEXT,
  plan TEXT DEFAULT 'free',
  "planExpiry" TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb,
  "receiptHeader" TEXT,
  "receiptFooter" TEXT,
  "receiptPaperSize" TEXT DEFAULT 'thermal',
  "fssaiNumber" TEXT,
  "invoiceTerms" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  "displayName" TEXT,
  role TEXT DEFAULT 'staff',
  "shopId" TEXT REFERENCES shops("shopId") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  "shopId" TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  unit TEXT,
  "purchasePrice" NUMERIC(12, 2) DEFAULT 0,
  "sellingPrice" NUMERIC(12, 2) DEFAULT 0,
  mrp NUMERIC(12, 2) DEFAULT 0,
  gst NUMERIC(5, 2) DEFAULT 0,
  stock NUMERIC(12, 2) DEFAULT 0,
  "minStock" NUMERIC(12, 2) DEFAULT 0,
  sku TEXT,
  barcode TEXT,
  "shortCode" TEXT,
  "isLoose" BOOLEAN DEFAULT FALSE,
  "expiryDate" DATE,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  "shopId" TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  balance NUMERIC(12, 2) DEFAULT 0,
  visits INT DEFAULT 0,
  "totalSpent" NUMERIC(12, 2) DEFAULT 0,
  "loyaltyPoints" INT DEFAULT 0,
  "aadharNumber" TEXT,
  "photoUrl" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  "shopId" TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  subtotal NUMERIC(12, 2) DEFAULT 0,
  "taxAmount" NUMERIC(12, 2) DEFAULT 0,
  "discountAmount" NUMERIC(12, 2) DEFAULT 0,
  "totalAmount" NUMERIC(12, 2) DEFAULT 0,
  "paymentMethod" TEXT,
  "customerId" TEXT REFERENCES customers(id) ON DELETE SET NULL,
  items JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  "shopId" TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  title TEXT,
  category TEXT,
  amount NUMERIC(12, 2) DEFAULT 0,
  description TEXT,
  date TIMESTAMPTZ,
  notes TEXT,
  "addedBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Udhar Transactions Table
CREATE TABLE IF NOT EXISTS udhar_transactions (
  id TEXT PRIMARY KEY,
  "shopId" TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  "customerId" TEXT REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) DEFAULT 0,
  type TEXT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  "shopId" TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  name TEXT NOT NULL,
  "contactPerson" TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  "gstNumber" TEXT,
  "paymentTerms" TEXT,
  balance NUMERIC(12, 2) DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  "shopId" TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  "supplierId" TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  "invoiceNumber" TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  "purchaseDate" TIMESTAMPTZ DEFAULT NOW(),
  "totalAmount" NUMERIC(12, 2) DEFAULT 0,
  "paidAmount" NUMERIC(12, 2) DEFAULT 0,
  "paymentStatus" TEXT DEFAULT 'paid',
  "paymentMethod" TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  "shopId" TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  channel TEXT DEFAULT 'system',
  "actionUrl" TEXT,
  "isRead" INT DEFAULT 0,
  "readBy" JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Promo Codes Table
CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  "discountPercent" NUMERIC(5, 2) DEFAULT 0,
  "flatDiscount" NUMERIC(10, 2) DEFAULT 0,
  "planType" TEXT,
  "maxUses" INT DEFAULT 100,
  "usedCount" INT DEFAULT 0,
  "validUntil" TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- 3. PERMISSIONS / DISABLE ROW LEVEL SECURITY (RLS)
-- Enables direct reading/writing via Supabase REST API & anon key
-- ==========================================================
ALTER TABLE shops DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE udhar_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ==========================================================
-- 4. INSERT EXISTING STORE DATA & 135 PRODUCTS
-- ==========================================================
`;

  const tables = [
    'shops',
    'users',
    'products',
    'customers',
    'transactions',
    'expenses',
    'udhar_transactions',
    'suppliers',
    'purchases',
    'notifications',
    'promo_codes'
  ];

  for (const table of tables) {
    try {
      const [rows] = await pool.query(`SELECT * FROM ${table}`);
      if (rows && rows.length > 0) {
        sql += `\n-- DATA FOR ${table.toUpperCase()} (${rows.length} rows)\n`;
        for (const row of rows) {
          const keys = Object.keys(row);
          const quotedKeys = keys.map(k => `"${k}"`).join(', ');
          const values = keys.map(k => escapeSql(row[k])).join(', ');
          sql += `INSERT INTO ${table} (${quotedKeys}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
        }
      }
    } catch (e) {
      console.warn(`Could not export data for table ${table}:`, e.message);
    }
  }

  const outPath = path.join(__dirname, '..', 'supabase_migration.sql');
  fs.writeFileSync(outPath, sql, 'utf8');
  console.log('✅ Supabase SQL migration successfully written to:', outPath);
  process.exit(0);
}

exportToSupabase().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
