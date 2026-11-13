-- ============================================================
-- NAYASHI KIRANA – COMPLETE SUPABASE SCHEMA
-- Run this ONCE in Supabase SQL Editor (dyuimjageamopkodfplk)
-- ============================================================

-- ── 1. DROP (optional clean-start, uncomment if needed) ───────────────────────
-- DROP TABLE IF EXISTS staff_salary_payments CASCADE;
-- DROP TABLE IF EXISTS staff_attendance CASCADE;
-- DROP TABLE IF EXISTS staff CASCADE;
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

-- ── 2. TABLES ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shops (
  "shopId"           TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  "ownerName"        TEXT NOT NULL DEFAULT '',
  phone              TEXT,
  email              TEXT,
  address            TEXT,
  "gstNumber"        TEXT,
  "upiId"            TEXT,
  "publicUrl"        TEXT,
  plan               TEXT DEFAULT 'free',
  "planExpiry"       TIMESTAMPTZ,
  settings           JSONB DEFAULT '{}'::jsonb,
  "receiptHeader"    TEXT,
  "receiptFooter"    TEXT,
  "receiptPaperSize" TEXT DEFAULT 'thermal',
  "fssaiNumber"      TEXT,
  "invoiceTerms"     TEXT,
  "createdAt"        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  uid           TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password      TEXT,
  "displayName" TEXT,
  role          TEXT DEFAULT 'staff',
  "shopId"      TEXT REFERENCES shops("shopId") ON DELETE SET NULL,
  "createdAt"   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  "shopId"        TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT,
  brand           TEXT,
  unit            TEXT,
  "purchasePrice" NUMERIC(12,2) DEFAULT 0,
  "sellingPrice"  NUMERIC(12,2) DEFAULT 0,
  mrp             NUMERIC(12,2) DEFAULT 0,
  gst             NUMERIC(5,2)  DEFAULT 0,
  stock           NUMERIC(12,2) DEFAULT 0,
  "minStock"      NUMERIC(12,2) DEFAULT 0,
  sku             TEXT,
  barcode         TEXT,
  "shortCode"     TEXT,
  "isLoose"       BOOLEAN DEFAULT FALSE,
  "expiryDate"    DATE,
  "imageUrl"      TEXT,
  variants        JSONB,
  "isDeleted"     INTEGER DEFAULT 0,
  "deletedAt"     TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id              TEXT PRIMARY KEY,
  "shopId"        TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  balance         NUMERIC(12,2) DEFAULT 0,
  visits          INTEGER DEFAULT 0,
  "totalSpent"    NUMERIC(12,2) DEFAULT 0,
  "loyaltyPoints" INTEGER DEFAULT 0,
  "aadharNumber"  TEXT,
  "photoUrl"      TEXT,
  "aadharPhotoUrl" TEXT,
  "isDeleted"     INTEGER DEFAULT 0,
  "deletedAt"     TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id               TEXT PRIMARY KEY,
  "shopId"         TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  subtotal         NUMERIC(12,2) DEFAULT 0,
  "taxAmount"      NUMERIC(12,2) DEFAULT 0,
  "discountAmount" NUMERIC(12,2) DEFAULT 0,
  "totalAmount"    NUMERIC(12,2) DEFAULT 0,
  "paymentMethod"  TEXT,
  "customerId"     TEXT REFERENCES customers(id) ON DELETE SET NULL,
  items            JSONB DEFAULT '[]'::jsonb,
  "isDeleted"      INTEGER DEFAULT 0,
  "deletedAt"      TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT PRIMARY KEY,
  "shopId"    TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  title       TEXT,
  category    TEXT,
  amount      NUMERIC(12,2) DEFAULT 0,
  description TEXT,
  date        TIMESTAMPTZ,
  notes       TEXT,
  "addedBy"   TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS udhar_transactions (
  id           TEXT PRIMARY KEY,
  "shopId"     TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  "customerId" TEXT REFERENCES customers(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) DEFAULT 0,
  type         TEXT,
  notes        TEXT,
  "createdAt"  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id              TEXT PRIMARY KEY,
  "shopId"        TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  name            TEXT NOT NULL,
  "contactPerson" TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  "gstNumber"     TEXT,
  "paymentTerms"  TEXT,
  balance         NUMERIC(12,2) DEFAULT 0,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
  id              TEXT PRIMARY KEY,
  "shopId"        TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  "supplierId"    TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  "invoiceNumber" TEXT,
  date            TIMESTAMPTZ DEFAULT NOW(),
  "purchaseDate"  TIMESTAMPTZ DEFAULT NOW(),
  "totalAmount"   NUMERIC(12,2) DEFAULT 0,
  "paidAmount"    NUMERIC(12,2) DEFAULT 0,
  "paymentStatus" TEXT DEFAULT 'paid',
  "paymentMethod" TEXT,
  items           JSONB DEFAULT '[]'::jsonb,
  notes           TEXT,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff (
  id          TEXT PRIMARY KEY,
  "shopId"    TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  role        TEXT DEFAULT 'Helper',
  "salaryType" TEXT DEFAULT 'monthly',
  salary      NUMERIC(12,2) DEFAULT 0,
  "joinDate"  DATE,
  address     TEXT,
  status      TEXT DEFAULT 'active',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id         TEXT PRIMARY KEY,
  "shopId"   TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  "staffId"  TEXT REFERENCES staff(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     TEXT NOT NULL,
  notes      TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_salary_payments (
  id              TEXT PRIMARY KEY,
  "shopId"        TEXT REFERENCES shops("shopId") ON DELETE CASCADE,
  "staffId"       TEXT REFERENCES staff(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  type            TEXT DEFAULT 'salary',
  "monthYear"     TEXT,
  "paymentDate"   DATE NOT NULL,
  "paymentMethod" TEXT DEFAULT 'Cash',
  notes           TEXT,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  "shopId"    TEXT,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT DEFAULT 'info',
  channel     TEXT DEFAULT 'system',
  "actionUrl" TEXT,
  "isRead"    INTEGER DEFAULT 0,
  "readBy"    JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  code              TEXT PRIMARY KEY,
  "discountPercent" NUMERIC(5,2)  DEFAULT 0,
  "flatDiscount"    NUMERIC(10,2) DEFAULT 0,
  "planType"        TEXT,
  "maxUses"         INTEGER DEFAULT 100,
  "usedCount"       INTEGER DEFAULT 0,
  "validUntil"      TIMESTAMPTZ,
  active            BOOLEAN DEFAULT TRUE,
  "createdAt"       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. SAFE COLUMN ADDITIONS (run if tables already exist) ───────────────────
ALTER TABLE products    ADD COLUMN IF NOT EXISTS "isDeleted" INTEGER DEFAULT 0;
ALTER TABLE products    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "isDeleted" INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE customers   ADD COLUMN IF NOT EXISTS "isDeleted" INTEGER DEFAULT 0;
ALTER TABLE customers   ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE customers   ADD COLUMN IF NOT EXISTS "aadharPhotoUrl" TEXT;

-- ── 4. DISABLE ROW LEVEL SECURITY (allows anon key full access) ──────────────
ALTER TABLE shops                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE users                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE products              DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers             DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses              DISABLE ROW LEVEL SECURITY;
ALTER TABLE udhar_transactions    DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers             DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchases             DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance      DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_salary_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         DISABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes           DISABLE ROW LEVEL SECURITY;

-- ── 5. GRANT FULL PERMISSIONS ─────────────────────────────────────────────────
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- After running this, execute from your terminal:
--   node scripts/sync_sqlite_to_supabase.cjs
-- to push all local data to Supabase.
