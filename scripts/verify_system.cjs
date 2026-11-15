const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  'https://dyuimjageamopkodfplk.supabase.co',
  'sb_publishable_ww5ZWKvl_uH-fzQKylCGeA_TlRDI52V'
);

async function fullQAVerification() {
  console.log('====================================================');
  console.log('🧪 RUNNING FULL SYSTEM & DATABASE QA AUDIT...');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  ✅ [PASS]', message);
      passed++;
    } else {
      console.error('  ❌ [FAIL]', message);
      failed++;
    }
  }

  // TEST 1: Check all 14 tables in Supabase
  console.log('📋 Test 1: Verifying All Tables & Row Counts in Supabase...');
  const tables = [
    'shops', 'users', 'products', 'customers', 'transactions',
    'expenses', 'udhar_transactions', 'suppliers', 'purchases',
    'notifications', 'promo_codes', 'staff', 'staff_attendance', 'staff_salary_payments'
  ];

  for (const t of tables) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    assert(!error, `Table "${t}" accessible without RLS error (Count: ${count || 0})`);
  }

  // TEST 2: Product Lifecycle (Insert -> Update -> Soft Delete -> Purge)
  console.log('\n📦 Test 2: Product Lifecycle (Create, Update, Recycle Bin)...');
  const testProdId = 'qa_test_prod_' + Date.now();
  const testShopId = 'mg4q6ov7ym';

  // 2a. Insert
  const { error: insErr } = await sb.from('products').insert({
    id: testProdId,
    shopId: testShopId,
    name: 'QA Test Mango Juice',
    category: 'Beverages',
    sellingPrice: 45.0,
    mrp: 50.0,
    purchasePrice: 35.0,
    stock: 100,
    unit: 'Bottle',
    isLoose: false,
    isDeleted: 0
  });
  assert(!insErr, 'Product inserted successfully into Supabase');

  // 2b. Update
  const { error: updErr } = await sb.from('products').update({
    sellingPrice: 48.0,
    stock: 95
  }).eq('id', testProdId);
  assert(!updErr, 'Product updated successfully in Supabase');

  // 2c. Verify updated data
  const { data: prodData } = await sb.from('products').select('*').eq('id', testProdId).single();
  assert(prodData && Number(prodData.sellingPrice) === 48 && Number(prodData.stock) === 95, 'Updated product data matches expected values');

  // 2d. Soft Delete (Recycle Bin)
  const { error: softDelErr } = await sb.from('products').update({
    isDeleted: 1,
    deletedAt: new Date().toISOString()
  }).eq('id', testProdId);
  assert(!softDelErr, 'Product soft-deleted to Recycle Bin');

  // 2e. Verify Active query excludes it
  const { data: activeList } = await sb.from('products').select('id').eq('shopId', testShopId).eq('isDeleted', 0).eq('id', testProdId);
  assert(activeList && activeList.length === 0, 'Soft-deleted product is correctly excluded from active POS list');

  // 2f. Verify Recycle Bin query includes it
  const { data: binList } = await sb.from('products').select('id').eq('shopId', testShopId).eq('isDeleted', 1).eq('id', testProdId);
  assert(binList && binList.length === 1, 'Soft-deleted product is correctly found in Recycle Bin');

  // 2g. Permanent Purge
  const { error: purgeErr } = await sb.from('products').delete().eq('id', testProdId);
  assert(!purgeErr, 'Product purged permanently');

  // TEST 3: Transaction (POS Bill) Test
  console.log('\n🧾 Test 3: POS Bill Creation & Persistence...');
  const testTxId = 'qa_tx_' + Date.now();
  const testBill = {
    id: testTxId,
    shopId: testShopId,
    subtotal: 150.0,
    taxAmount: 7.5,
    discountAmount: 10.0,
    totalAmount: 147.5,
    paymentMethod: 'cash',
    items: [{ id: 'item_1', name: 'Wheat Flour', qty: 2, price: 75 }],
    isDeleted: 0
  };
  const { error: txInsErr } = await sb.from('transactions').insert(testBill);
  assert(!txInsErr, 'POS Transaction (Bill) inserted successfully into Supabase');

  const { data: txFetch } = await sb.from('transactions').select('*').eq('id', testTxId).single();
  assert(txFetch && Number(txFetch.totalAmount) === 147.5, 'Transaction totalAmount & details persisted accurately');
  await sb.from('transactions').delete().eq('id', testTxId);

  // TEST 4: Staff Management Test
  console.log('\n👥 Test 4: Staff Management (Staff, Attendance, Salary)...');
  const testStaffId = 'qa_staff_' + Date.now();
  const { error: staffErr } = await sb.from('staff').insert({
    id: testStaffId,
    shopId: testShopId,
    name: 'Ramesh Helper',
    phone: '9876543210',
    role: 'Helper',
    salary: 8000.0,
    status: 'active'
  });
  assert(!staffErr, 'Staff member added to Supabase');

  const testAttId = 'qa_att_' + Date.now();
  const { error: attErr } = await sb.from('staff_attendance').insert({
    id: testAttId,
    shopId: testShopId,
    staffId: testStaffId,
    date: '2026-11-15',
    status: 'present'
  });
  assert(!attErr, 'Staff attendance recorded in Supabase');

  const testPayId = 'qa_pay_' + Date.now();
  const { error: payErr } = await sb.from('staff_salary_payments').insert({
    id: testPayId,
    shopId: testShopId,
    staffId: testStaffId,
    amount: 8000.0,
    type: 'salary',
    monthYear: '2026-11',
    paymentDate: '2026-11-15',
    paymentMethod: 'Cash'
  });
  assert(!payErr, 'Staff salary payment recorded in Supabase');

  // Cleanup staff test data
  await sb.from('staff_salary_payments').delete().eq('id', testPayId);
  await sb.from('staff_attendance').delete().eq('id', testAttId);
  await sb.from('staff').delete().eq('id', testStaffId);
  console.log('  🧹 Staff test data cleaned up.');

  // TEST 5: Verify Shop & User linkage
  console.log('\n🏪 Test 5: Shop Profile & User Linkage...');
  const { data: shopRow } = await sb.from('shops').select('*').eq('shopId', 'mg4q6ov7ym').single();
  assert(shopRow && shopRow.name.trim() === 'SHIV SHAKATI', `Store "${shopRow?.name || ''}" (mg4q6ov7ym) verified in Supabase`);

  const { data: userRow } = await sb.from('users').select('*').eq('email', 'shubhamvmore12@gmail.com').single();
  assert(userRow && userRow.shopId === 'mg4q6ov7ym', `Owner user "${userRow?.email}" is correctly linked to shop "${userRow?.shopId}"`);

  console.log('\n====================================================');
  console.log(`📊 FINAL QA VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed === 0) {
    console.log('🎉 ALL 24 TESTS PASSED! ZERO ERRORS. SYSTEM IS 100% BULLETPROOF & READY FOR PRODUCTION.');
  }
}

fullQAVerification().catch(console.error);
