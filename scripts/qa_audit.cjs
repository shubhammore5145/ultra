// Single-process Integration Test Runner
const path = require('path');

// Override port to avoid conflicts
process.env.PORT = '5001';

// Require backend server
console.log('Starting in-process backend server on port 5001...');
require('../backend/server.js');

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';
const TEST_SHOP_ID = 'mg4q6ov7ym';
const TEST_UID = 'hRE9VUXuINWnIKweD8ohS7jn3z72';

const testToken = jwt.sign({ uid: TEST_UID, shopId: TEST_SHOP_ID, role: 'admin' }, JWT_SECRET);
const BASE_URL = 'http://127.0.0.1:5001';
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${testToken}`
};

const results = [];
function record(name, passed, details) {
  results.push({ name, passed, details });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${name} ${details ? '- ' + JSON.stringify(details) : ''}`);
}

async function run() {
  // Wait 1.5s for server to start
  await new Promise(r => setTimeout(r, 1500));

  console.log('\n====================================================');
  console.log('🧪 Senior Developer Full Integration Test Suite');
  console.log('====================================================\n');

  // 1. Health check
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    record('Backend Health API (/api/health)', res.ok && data.status === 'healthy', { status: data.status, uptime: data.uptime });
  } catch (err) {
    record('Backend Health API', false, { error: err.message });
  }

  // 2. Auth /me verification
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, { headers });
    const data = await res.json();
    record('Auth /me Endpoint', res.ok && data.user?.shopId === TEST_SHOP_ID, { user: data.user?.displayName, shop: data.shop?.name });
  } catch (err) {
    record('Auth /me Endpoint', false, { error: err.message });
  }

  // 3. Products List
  let testProdId = 'qa_test_' + Date.now();
  try {
    const listRes = await fetch(`${BASE_URL}/api/products`, { headers });
    const listData = await listRes.json();
    record('Products List (/api/products)', Array.isArray(listData) && listData.length > 0, { count: listData.length });

    // Create a product
    const createRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: testProdId,
        name: 'QA Test Wheat 5kg',
        category: 'Grains & Pulses',
        brand: 'Aashirvaad',
        unit: 'kg',
        purchasePrice: 200,
        sellingPrice: 240,
        mrp: 260,
        gst: 0,
        stock: 20,
        minStock: 5,
        sku: 'WHT-5KG-QA',
        barcode: '990011223344',
        isLoose: 0
      })
    });
    record('Product Creation (POST /api/products)', createRes.ok);

    // Update product
    const updateRes = await fetch(`${BASE_URL}/api/products/${testProdId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        stock: 18,
        sellingPrice: 245
      })
    });
    record('Product Update (PUT /api/products/:id)', updateRes.ok);
  } catch (err) {
    record('Product CRUD', false, { error: err.message });
  }

  // 4. Customers List & Creation
  let testCustId = 'cust_qa_' + Date.now();
  try {
    const listRes = await fetch(`${BASE_URL}/api/customers`, { headers });
    const listData = await listRes.json();
    record('Customers List (/api/customers)', Array.isArray(listData), { count: listData.length });

    const createRes = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: testCustId,
        name: 'Ganesh Shinde (QA Test)',
        phone: '9822001122',
        address: 'Sector 4, Waluj',
        balance: 0
      })
    });
    record('Customer Creation (POST /api/customers)', createRes.ok);
  } catch (err) {
    record('Customer CRUD', false, { error: err.message });
  }

  // 5. POS Transaction Simulation (Cart, Discount, Stock Deduction)
  let testTxId = 'tx_qa_' + Date.now();
  try {
    const txRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: testTxId,
        subtotal: 490,
        taxAmount: 0,
        discountAmount: 10,
        totalAmount: 480,
        paymentMethod: 'cash',
        customerId: testCustId,
        items: [
          {
            id: testProdId,
            name: 'QA Test Wheat 5kg',
            qty: 2,
            price: 245,
            total: 490
          }
        ]
      })
    });
    record('POS Checkout Transaction (POST /api/transactions)', txRes.ok);

    // Verify stock deduction
    const prodRes = await fetch(`${BASE_URL}/api/products`, { headers });
    const prods = await prodRes.json();
    const targetProd = prods.find(p => p.id === testProdId);
    record('Stock Auto-Deduction Verification', targetProd && targetProd.stock === 16, { expected: 16, actual: targetProd?.stock });
  } catch (err) {
    record('POS Transaction Flow', false, { error: err.message });
  }

  // 6. Public Receipt Lookup (No Auth required)
  try {
    const recRes = await fetch(`${BASE_URL}/api/public/receipt/${testTxId}`);
    const recData = await recRes.json();
    record('Public Digital Receipt Route (/api/public/receipt/:id)', recRes.ok && recData.id === testTxId, { total: recData.totalAmount });
  } catch (err) {
    record('Public Digital Receipt Route', false, { error: err.message });
  }

  // 7. Transactions List for Reports
  try {
    const txListRes = await fetch(`${BASE_URL}/api/transactions`, { headers });
    const txListData = await txListRes.json();
    const hasItemsParsed = Array.isArray(txListData) && txListData.length > 0 && Array.isArray(txListData[0].items);
    record('Transactions Query for Reports & Bill Registry', hasItemsParsed, { count: txListData.length, sampleItemsIsArray: Array.isArray(txListData[0]?.items) });
  } catch (err) {
    record('Transactions Query for Reports', false, { error: err.message });
  }

  // 8. Udhar Ledger & Repayment
  try {
    const udharTxId = 'udh_qa_' + Date.now();
    const createUdhar = await fetch(`${BASE_URL}/api/udhar`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: udharTxId,
        customerId: testCustId,
        amount: 250,
        type: 'credit',
        notes: 'QA Udhar Test'
      })
    });
    record('Udhar Khata Entry (POST /api/udhar)', createUdhar.ok);

    // Repay partial
    const repayUdhar = await fetch(`${BASE_URL}/api/udhar`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: 'rep_qa_' + Date.now(),
        customerId: testCustId,
        amount: 150,
        type: 'payment',
        notes: 'QA Partial Payment'
      })
    });
    record('Udhar Repayment (POST /api/udhar type=payment)', repayUdhar.ok);

    // Check balance
    const custRes = await fetch(`${BASE_URL}/api/customers`, { headers });
    const custs = await custRes.json();
    const c = custs.find(x => x.id === testCustId);
    record('Udhar Balance Accuracy (250 credit - 150 payment = 100)', c && Number(c.balance) === 100, { actualBalance: c?.balance });
  } catch (err) {
    record('Udhar Repayment Flow', false, { error: err.message });
  }

  // 9. Auth Rate Limiting Protection Test
  try {
    let blocked = false;
    for (let i = 0; i < 30; i++) {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'hacker@test.com', password: 'wrong' })
      });
      if (res.status === 429) {
        blocked = true;
        break;
      }
    }
    record('Security Brute-force Rate Limiting (HTTP 429)', blocked);
  } catch (err) {
    record('Security Rate Limiting', false, { error: err.message });
  }

  // 10. Clean up test records
  try {
    await fetch(`${BASE_URL}/api/products/${testProdId}`, { method: 'DELETE', headers });
    record('Test Product Cleanup', true);
  } catch (e) {}

  console.log('\n====================================================');
  const passCount = results.filter(r => r.passed).length;
  console.log(`📊 Test Summary: ${passCount}/${results.length} Tests Passed (${Math.round((passCount/results.length)*100)}%)`);
  console.log('====================================================\n');

  process.exit(passCount === results.length ? 0 : 1);
}

run().catch(e => {
  console.error('Test runner fatal error:', e);
  process.exit(1);
});

