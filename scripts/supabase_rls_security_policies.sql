-- ==============================================================================
-- NAYASHI KIRANA / MARTGPT — PRODUCTION ROW LEVEL SECURITY (RLS) POLICIES
-- Target: Supabase PostgreSQL Database (https://dyuimjageamopkodfplk.supabase.co)
-- Security: Multi-Tenant Tenant Isolation & Public Digital Receipt Access
-- ==============================================================================

-- 1. ENABLE ROW LEVEL SECURITY ACROSS ALL 14 TABLES
ALTER TABLE IF EXISTS shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS udhar_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff_salary_payments ENABLE ROW LEVEL SECURITY;

-- Revoke dangerous global public writes
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;

-- ==============================================================================
-- 2. HELPER FUNCTIONS FOR TENANT CONTEXT & ATOMIC CONCURRENCY
-- ==============================================================================

-- Atomic stock decrement function (prevents multi-counter race conditions)
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id TEXT, p_qty NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET stock = GREATEST(0, COALESCE(stock, 0) - p_qty)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic stock increment function (for returns & purchases)
CREATE OR REPLACE FUNCTION increment_stock(p_product_id TEXT, p_qty NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET stock = COALESCE(stock, 0) + p_qty
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. DROP EXISTING POLICIES (CLEAN IDEMPOTENT RUN)
-- ==============================================================================
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ==============================================================================
-- 4. SHOPS TABLE POLICIES
-- ==============================================================================
-- Public read for digital bills (store name, phone, address on /receipt/:id)
CREATE POLICY "Public Read Shop Storefront" ON shops
  FOR SELECT USING ( true );

-- Authenticated merchants can update their own shop record
CREATE POLICY "Tenant Update Own Shop" ON shops
  FOR UPDATE USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

-- ==============================================================================
-- 5. PRODUCTS TABLE POLICIES
-- ==============================================================================
CREATE POLICY "Tenant Products Access" ON products
  FOR ALL USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR "shopId" IS NULL
    OR auth.role() = 'service_role'
  );

-- ==============================================================================
-- 6. TRANSACTIONS & RECEIPTS POLICIES
-- ==============================================================================
-- Public read allows customers with the direct invoice link to view their E-Bill
CREATE POLICY "Public E-Receipt View" ON transactions
  FOR SELECT USING ( true );

-- Insert & Update restricted to tenant shop
CREATE POLICY "Tenant Insert Transactions" ON transactions
  FOR INSERT WITH CHECK (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Tenant Modify Transactions" ON transactions
  FOR UPDATE USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Tenant Delete Transactions" ON transactions
  FOR DELETE USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

-- ==============================================================================
-- 7. CUSTOMERS & UDHAR (KHATA) POLICIES
-- ==============================================================================
CREATE POLICY "Tenant Customers Isolation" ON customers
  FOR ALL USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Tenant Udhar Isolation" ON udhar_transactions
  FOR ALL USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

-- ==============================================================================
-- 8. EXPENSES, SUPPLIERS & PURCHASES POLICIES
-- ==============================================================================
CREATE POLICY "Tenant Expenses Isolation" ON expenses
  FOR ALL USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Tenant Suppliers Isolation" ON suppliers
  FOR ALL USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Tenant Purchases Isolation" ON purchases
  FOR ALL USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

-- ==============================================================================
-- 9. STAFF, ATTENDANCE & PAYROLL POLICIES
-- ==============================================================================
CREATE POLICY "Tenant Staff Isolation" ON staff
  FOR ALL USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Tenant Staff Attendance Isolation" ON staff_attendance
  FOR ALL USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Tenant Staff Salary Isolation" ON staff_salary_payments
  FOR ALL USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR auth.role() = 'service_role'
  );

-- ==============================================================================
-- 10. NOTIFICATIONS & PROMO CODES
-- ==============================================================================
CREATE POLICY "Tenant Notifications" ON notifications
  FOR ALL USING (
    "shopId" = COALESCE(auth.jwt() ->> 'shopId', current_setting('request.headers', true)::json->>'x-shop-id')
    OR "shopId" IS NULL
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Promo Codes Read" ON promo_codes
  FOR SELECT USING ( active = true );
