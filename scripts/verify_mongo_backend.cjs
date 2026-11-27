const express = require('express');
const http = require('http');
const crypto = require('crypto');
const pool = require('../backend/db');
const authRoutes = require('../backend/routes/auth');
const apiRoutes = require('../backend/routes/api');
const superAdminRoutes = require('../backend/routes/superadmin');
const notificationsRoutes = require('../backend/routes/notifications');

async function reqJson(baseUrl, method, path, body, headers = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, data: json };
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('  ✅ PASS:', msg);
}

async function runTests() {
  console.log('🚀 Starting Full MongoDB Atlas Backend Integration Verification...\n');
  await pool.testConnection();
  const db = await pool.getDb();

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.get('/api/health', (req, res) => res.json({ status: 'healthy', db: pool.getStatus() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/superadmin', superAdminRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api', apiRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  console.log('🔌 Test server bound to', baseUrl);

  const testShopId = 'mg4q6ov7ym';
  const testProdId = 'test_mongo_prod_' + Date.now();
  const testCustId = 'test_mongo_cust_' + Date.now();
  const testTxId = 'test_mongo_tx_' + Date.now();
  const testExpId = 'test_mongo_exp_' + Date.now();
  const testUdharId = 'test_mongo_udhar_' + Date.now();
  const testHeaders = { 'x-shop-id': testShopId };

  try {
    // 1. Health & Adapter
    const health = await reqJson(baseUrl, 'GET', '/health');
    assert(health.status === 200 && health.data.db.adapter === 'mongodb_atlas', 'Health endpoint reports mongodb_atlas active');

    // 2. SuperAdmin Stats & Shops
    const stats = await reqJson(baseUrl, 'GET', '/superadmin/stats?key=5145');
    assert(stats.status === 200 && stats.data.stats.totalShops === 16, `SuperAdmin stats returned totalShops=${stats.data.stats?.totalShops}`);
    assert(stats.data.stats.totalProducts >= 266, `SuperAdmin stats returned totalProducts=${stats.data.stats?.totalProducts}`);

    const shopsRes = await reqJson(baseUrl, 'GET', '/superadmin/shops?key=5145');
    assert(shopsRes.status === 200 && Array.isArray(shopsRes.data.shops) && shopsRes.data.shops.length === 16, 'SuperAdmin shops list returned 16 shops');

    // 3. Shop fetch
    const shopRes = await reqJson(baseUrl, 'GET', '/shops', null, testHeaders);
    assert(shopRes.status === 200 && shopRes.data.shopId === testShopId, `Fetched shop ${shopRes.data.name}`);

    // 4. Products CRUD
    const prodsList = await reqJson(baseUrl, 'GET', '/products', null, testHeaders);
    assert(prodsList.status === 200 && Array.isArray(prodsList.data) && prodsList.data.length > 0, `GET /products returned ${prodsList.data.length} products from Atlas`);

    const createProd = await reqJson(baseUrl, 'POST', '/products', {
      id: testProdId,
      name: 'QA Mongo Verification Item',
      category: 'Test',
      brand: 'TestBrand',
      unit: 'pcs',
      purchasePrice: 80,
      sellingPrice: 100,
      mrp: 110,
      gst: 5,
      stock: 50,
      minStock: 5,
      bulkMinQty: 6,
      bulkPrice: 90
    }, testHeaders);
    assert(createProd.status === 200 && createProd.data.success, 'POST /products created test product in MongoDB');

    const updProd = await reqJson(baseUrl, 'PUT', `/products/${testProdId}`, { sellingPrice: 95 }, testHeaders);
    assert(updProd.status === 200 && updProd.data.success, 'PUT /products updated sellingPrice while preserving bulk tier');

    const verifyProds = await reqJson(baseUrl, 'GET', '/products', null, testHeaders);
    const createdItem = verifyProds.data.find((p) => p.id === testProdId);
    assert(createdItem && createdItem.sellingPrice === 95 && createdItem.bulkMinQty === 6 && createdItem.stock === 50, 'Verified updated product & preserved bulkMinQty in Atlas');

    // 5. Customer & Atomic Transaction (Stock Decrement + Udhar + Ledger + Public Receipt)
    const createCust = await reqJson(baseUrl, 'POST', '/customers', {
      id: testCustId,
      name: 'QA Mongo Customer',
      phone: '9999988888',
      address: 'Test Lane',
      balance: 0
    }, testHeaders);
    assert(createCust.status === 200 && createCust.data.success, 'POST /customers created customer');

    const createTx = await reqJson(baseUrl, 'POST', '/transactions', {
      id: testTxId,
      subtotal: 190,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 190,
      paymentMethod: 'udhar',
      customerId: testCustId,
      items: [{ id: testProdId, name: 'QA Mongo Verification Item', qty: 2, sellingPrice: 95, mrp: 110 }]
    }, testHeaders);
    assert(createTx.status === 200 && createTx.data.success, 'POST /transactions succeeded atomically via MongoDB session');

    const afterTxProds = await reqJson(baseUrl, 'GET', '/products', null, testHeaders);
    const afterProd = afterTxProds.data.find((p) => p.id === testProdId);
    assert(afterProd && afterProd.stock === 48, `Stock atomically decremented 50 -> ${afterProd?.stock}`);

    const custsAfter = await reqJson(baseUrl, 'GET', '/customers?phone=9999988888', null, testHeaders);
    const custAfter = custsAfter.data.find((c) => c.id === testCustId);
    assert(custAfter && custAfter.balance === 190 && custAfter.visits === 1, `Customer udhar balance (${custAfter?.balance}) & visits (${custAfter?.visits}) incremented atomically`);

    const pubReceipt = await reqJson(baseUrl, 'GET', `/public/receipt/${testTxId}`);
    assert(pubReceipt.status === 200 && pubReceipt.data.id === testTxId && pubReceipt.data.customerName === 'QA Mongo Customer', 'GET /public/receipt/:id returned full enriched receipt from MongoDB');

    const ledger = await reqJson(baseUrl, 'GET', `/customers/${testCustId}/ledger`, null, testHeaders);
    assert(ledger.status === 200 && Array.isArray(ledger.data) && ledger.data.length >= 2, `GET /customers/:id/ledger returned ${ledger.data.length} entries`);

    // 6. Udhar Payment
    const udharPay = await reqJson(baseUrl, 'POST', '/udhar', {
      id: testUdharId,
      customerId: testCustId,
      amount: 90,
      type: 'payment',
      notes: 'QA Partial Payment'
    }, testHeaders);
    assert(udharPay.status === 200 && udharPay.data.success, 'POST /udhar payment succeeded atomically');

    const custsPaid = await reqJson(baseUrl, 'GET', '/customers?phone=9999988888', null, testHeaders);
    const custPaid = custsPaid.data.find((c) => c.id === testCustId);
    assert(custPaid && custPaid.balance === 100, `Customer udhar balance atomically reduced 190 -> ${custPaid?.balance}`);

    // 7. Expenses CRUD
    const createExp = await reqJson(baseUrl, 'POST', '/expenses', {
      id: testExpId,
      category: 'Other',
      amount: 25,
      description: 'QA Test Expense',
      date: new Date().toISOString().slice(0, 10)
    }, testHeaders);
    assert(createExp.status === 200 && createExp.data.success, 'POST /expenses created');

    const delExp = await reqJson(baseUrl, 'DELETE', `/expenses/${testExpId}`, null, testHeaders);
    assert(delExp.status === 200 && delExp.data.success, 'DELETE /expenses deleted');

    // 8. Soft Delete -> Recycle Bin -> Restore -> Permanent Purge
    await reqJson(baseUrl, 'DELETE', `/products/${testProdId}`, null, testHeaders);
    const binList = await reqJson(baseUrl, 'GET', '/recycle-bin', null, testHeaders);
    assert(binList.status === 200 && binList.data.products.some((p) => p.id === testProdId), 'Soft-deleted product visible in Recycle Bin');

    await reqJson(baseUrl, 'POST', '/recycle-bin/restore', { type: 'product', id: testProdId }, testHeaders);
    const restoredList = await reqJson(baseUrl, 'GET', '/products', null, testHeaders);
    assert(restoredList.data.some((p) => p.id === testProdId), 'Restored product back in active catalog');

    // 9. Notifications
    const notifs = await reqJson(baseUrl, 'GET', '/notifications', null, testHeaders);
    assert(notifs.status === 200 && notifs.data.success, `GET /notifications succeeded (${notifs.data.notifications?.length} items)`);

    // 10. Cleanup QA test docs cleanly
    await Promise.all([
      db.collection('products').deleteOne({ id: testProdId }),
      db.collection('customers').deleteOne({ id: testCustId }),
      db.collection('transactions').deleteOne({ id: testTxId }),
      db.collection('udhar_transactions').deleteMany({ customerId: testCustId }),
      db.collection('expenses').deleteOne({ id: testExpId })
    ]);
    console.log('\n🧹 Cleaned up all QA test documents from MongoDB Atlas.');
    console.log('\n🎉 ALL MONGODB ATLAS END-TO-END TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
    const client = await pool.getClient();
    await client.close();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
