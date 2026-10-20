-- ==========================================================
-- SUPABASE SCHEMA FOR NAYASHI KIRANA / MARTGPT
-- Project: https://dyuimjageamopkodfplk.supabase.co
-- Paste this entire script into Supabase SQL Editor and click "RUN"
-- ==========================================================

-- 1. SHOPS TABLE
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

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  "displayName" TEXT,
  role TEXT DEFAULT 'staff',
  "shopId" TEXT REFERENCES shops("shopId") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUCTS TABLE
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

-- 4. CUSTOMERS TABLE
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

-- 5. TRANSACTIONS TABLE
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

-- 6. EXPENSES TABLE
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

-- 7. UDHAR TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS udhar_transactions (
  id TEXT PRIMARY KEY,
  "shopId" TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  "customerId" TEXT REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) DEFAULT 0,
  type TEXT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SUPPLIERS TABLE
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

-- 9. PURCHASES TABLE
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

-- 10. NOTIFICATIONS TABLE
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

-- 11. PROMO CODES TABLE
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
-- DISABLE ROW LEVEL SECURITY (RLS) FOR FULL REST API ACCESS
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

-- Grant permissions to Supabase roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
