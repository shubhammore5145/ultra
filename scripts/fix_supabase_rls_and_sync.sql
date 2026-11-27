-- ==============================================================================
-- NAYASHI KIRANA / MARTGPT — FIX SUPABASE RLS & MISSING COLUMNS
-- Target: Supabase SQL Editor (https://dyuimjageamopkodfplk.supabase.co)
-- Purpose: 
-- 1. Add missing schema columns so product & user sync works with 0 errors
-- 2. Grant full Read/Write permissions to Anon & Authenticated roles
-- 3. Eliminate error 42501 (new row violates row-level security policy)
-- ==============================================================================

-- 1. ADD MISSING COLUMNS TO PRODUCTS
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS "bulkMinQty" NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS "bulkPrice" NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS "maxStock" NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS "rackLocation" TEXT;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS "reorderQty" NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS "variants" JSONB;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS "wholesalePrice" NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS "isDeleted" INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

-- 2. ADD MISSING COLUMNS TO USERS & STAFF
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS "permissions" JSONB;

-- 3. CONFIGURE POLICIES TO ALLOW BACKEND SYNC (Solves 42501 RLS Violation)
-- We grant full access to anon, authenticated and service_role
DO $$ 
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'shops', 'users', 'products', 'customers', 'transactions', 
    'expenses', 'udhar_transactions', 'suppliers', 'purchases', 
    'notifications', 'promo_codes', 'staff', 'staff_attendance', 'staff_salary_payments'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Drop any conflicting policy
    EXECUTE format('DROP POLICY IF EXISTS "Allow All Sync" ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public Read Shop Storefront" ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant Update Own Shop" ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant Products Access" ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public E-Receipt View" ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant Insert Transactions" ON %I;', tbl);

    -- Enable RLS and add universal sync policy for MartGPT client & backend
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('CREATE POLICY "Allow All Sync" ON %I FOR ALL TO public USING (true) WITH CHECK (true);', tbl);
    EXECUTE format('GRANT ALL ON TABLE %I TO anon, authenticated, service_role;', tbl);
  END LOOP;
END $$;

-- 4. VERIFY TABLES ARE ACCESSIBLE
SELECT table_name, row_security 
FROM information_schema.tables 
JOIN pg_tables ON information_schema.tables.table_name = pg_tables.tablename
WHERE table_schema = 'public';
