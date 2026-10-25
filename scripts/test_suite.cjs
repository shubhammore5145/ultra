const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';
const TEST_SHOP_ID = 'mg4q6ov7ym';
const TEST_UID = 'hRE9VUXuINWnIKweD8ohS7jn3z72';

const testToken = jwt.sign({ uid: TEST_UID, shopId: TEST_SHOP_ID, role: 'admin' }, JWT_SECRET);
const BASE_URL = 'http://localhost:5000';
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${testToken}`
};

const results = [];

function record(name, passed, details) {
  results.push({ name, passed, details });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${name} ${details ? '- ' + JSON.stringify(details) : ''}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Nayashi Kirana / MartGPT Full Automated Test');
  console.log('====================================================\n');

  // 1. Health check
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    record('Backend Health API', res.ok && data.status === 'healthy', { status: data.status, adapter: data.db?.adapter });
  } catch (err) {
    record('Backend Health API', false, { error: err.message });
  }

  // 2. Auth /me
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, { headers });
    const data = await res.json();
    record('Auth Verification (/api/auth/me)', res.ok && data.user?.shopId === TEST_SHOP_ID, { user: data.user?.displayName, shop: data.shop?.name });
  } catch (err) {
    record('Auth Verification (/api/auth/me)', false, { error: err.message });
  }

  // 3. Products List & CRUD
  let createdProductId = 'test_prod_' + Date.now();
  try {
    // List
    const listRes = await fetch(`${BASE_URL}/api/products`, { headers });
    const listData = await listRes.json();
    record('Products List', Array.isArray(listData), { count: listData.length });

    // Create
    const createRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: createdProductId,
        name: 'Automated Test Product Oil 1L',
        category: 'Grocery',
        brand: 'Fortune',
        unit: 'Ltr',
        purchasePrice: 120,
        sellingPrice: 150,
        mrp: 160,
        gst: 5,
        stock: 50,
        minStock: 10,
        sku: 'OIL-1L-TEST',
        barcode: '8901234567890',
        isLoose: false
      })
    });
    record('Product Create', createRes.ok, await createRes.json());

    // Update
    const updateRes = await fetch(`${BASE_URL}/api/products/${createdProductId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        stock: 45,
        sellingPrice: 148
      })
    });
    record('Product Update', updateRes.ok, await updateRes.json());
  } catch (err) {
    record('Product Operations', false, { error: err.message });
  }

  // 4. Customers List & CRUD
  let createdCustomerId = 'test_cust_' + Date.now();
  try {
    const listRes = await fetch(`${BASE_URL}/api/customers`, { headers });
    const listData = await listRes.json();
    record('Customers List', Array.isArray(listData), { count: listData.length });

    // Create Customer
    const createRes = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: createdCustomerId,
        name: 'Suresh Patil (Test Customer)',
        phone: '9876543210',
        address: 'Shivaji Chowk, Waluj',
        balance: 0
      })
    });
    record('Customer Create', createRes.ok, await createRes.json());
  } catch (err) {
    record('Customer Operations', false, { error: err.message });
  }

  // 5. POS Transaction with Stock Deduction & Udhar balance update
  let createdTxId = 'tx_test_' + Date.now();
  try {
    const txRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: createdTxId,
        subtotal: 296,
        taxAmount: 14.8,
        discountAmount: 10,
        totalAmount: 300,
        paymentMethod: 'udhar',
        customerId: createdCustomerId,
        items: [
          {
            id: createdProductId,
            name: 'Automated Test Product Oil 1L',
            qty: 2,
            price: 148,
            total: 296
          }
        ]
      })
    });
    const txData = await txRes.json();
    record('POS Transaction Creation (Udhar)', txRes.ok && txData.success, txData);

    // Verify Stock deduction
    const prodCheck = await fetch(`${BASE_URL}/api/products`, { headers });
    const prodList = await prodCheck.json();
    const updatedProd = prodList.find(p => p.id === createdProductId);
    // Initial was 45, sold 2 -> should be 43
    record('Stock Auto-Deduction in Products', updatedProd && updatedProd.stock === 43, { currentStock: updatedProd?.stock, expected: 43 });

    // Verify Customer Udhar balance
    const custCheck = await fetch(`${BASE_URL}/api/customers`, { headers });
    const custList = await custCheck.json();
    const updatedCust = custList.find(c => c.id === createdCustomerId);
    record('Customer Udhar Balance Increase', updatedCust && updatedCust.balance === 300, { currentBalance: updatedCust?.balance, expected: 300 });

    // Verify Customer Ledger / Passbook
    const ledgerRes = await fetch(`${BASE_URL}/api/customers/${createdCustomerId}/ledger`, { headers });
    const ledgerData = await ledgerRes.json();
    record('Customer Ledger / Passbook Statement', Array.isArray(ledgerData) && ledgerData.length >= 1, { entries: ledgerData.length });
  } catch (err) {
    record('POS & Stock Transaction Flow', false, { error: err.message });
  }

  // 6. Udhar Repayment
  try {
    const udharPayId = 'udhar_pay_' + Date.now();
    const payRes = await fetch(`${BASE_URL}/api/udhar`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: udharPayId,
        customerId: createdCustomerId,
        amount: 200,
        type: 'payment',
        notes: 'Cash received partial payment'
      })
    });
    record('Udhar Repayment Entry', payRes.ok, await payRes.json());

    // Verify balance after partial payment (300 - 200 = 100)
    const custCheck = await fetch(`${BASE_URL}/api/customers`, { headers });
    const custList = await custCheck.json();
    const updatedCust = custList.find(c => c.id === createdCustomerId);
    record('Customer Balance after Udhar Payment', updatedCust && updatedCust.balance === 100, { currentBalance: updatedCust?.balance, expected: 100 });
  } catch (err) {
    record('Udhar Repayment Flow', false, { error: err.message });
  }

  // 7. Public Receipt View
  try {
    const receiptRes = await fetch(`${BASE_URL}/api/public/receipt/${createdTxId}`);
    const receiptData = await receiptRes.json();
    record('Public Digital Receipt Route', receiptRes.ok && receiptData.id === createdTxId, { shop: receiptData.shopName, total: receiptData.totalAmount });
  } catch (err) {
    record('Public Digital Receipt Route', false, { error: err.message });
  }

  // 8. Purchases & Supplier Flow
  let createdSupplierId = 'supp_' + Date.now();
  try {
    // Create Supplier
    const suppRes = await fetch(`${BASE_URL}/api/suppliers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: createdSupplierId,
        name: 'Kisan Wholesale Traders',
        phone: '9988776655',
        address: 'APMC Market Aurangabad',
        balance: 0
      })
    });
    record('Supplier Create', suppRes.ok, await suppRes.json());

    // Purchase Stock-In
    const purchaseRes = await fetch(`${BASE_URL}/api/purchases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        supplierId: createdSupplierId,
        invoiceNumber: 'INV-2026-001',
        date: new Date().toISOString(),
        totalAmount: 1200,
        paidAmount: 1000,
        paymentStatus: 'partial',
        items: [
          {
            productId: createdProductId,
            qty: 10,
            purchasePrice: 120
          }
        ],
        notes: 'Bulk purchase test'
      })
    });
    record('Purchase Stock-In Entry', purchaseRes.ok, await purchaseRes.json());

    // Verify stock increment (43 + 10 = 53)
    const prodCheck = await fetch(`${BASE_URL}/api/products`, { headers });
    const prodList = await prodCheck.json();
    const restockedProd = prodList.find(p => p.id === createdProductId);
    record('Stock Auto-Increment after Purchase', restockedProd && restockedProd.stock === 53, { currentStock: restockedProd?.stock, expected: 53 });

    // Verify supplier unpaid balance (1200 - 1000 = 200)
    const suppListRes = await fetch(`${BASE_URL}/api/suppliers`, { headers });
    const suppList = await suppListRes.json();
    const updatedSupp = suppList.find(s => s.id === createdSupplierId);
    record('Supplier Balance Update for Unpaid Purchase', updatedSupp && updatedSupp.balance === 200, { supplierBalance: updatedSupp?.balance, expected: 200 });
  } catch (err) {
    record('Purchases & Supplier Flow', false, { error: err.message });
  }

  // 9. Expenses Flow
  let createdExpId = 'exp_' + Date.now();
  try {
    const expRes = await fetch(`${BASE_URL}/api/expenses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: createdExpId,
        category: 'Electricity',
        amount: 850,
        description: 'Shop power bill',
        date: new Date().toISOString()
      })
    });
    record('Expense Create', expRes.ok, await expRes.json());

    const expListRes = await fetch(`${BASE_URL}/api/expenses`, { headers });
    const expList = await expListRes.json();
    record('Expenses List', Array.isArray(expList) && expList.some(e => e.id === createdExpId), { count: expList.length });
  } catch (err) {
    record('Expenses Flow', false, { error: err.message });
  }

  // 10. Notifications Flow
  try {
    const notifRes = await fetch(`${BASE_URL}/api/notifications`, { headers });
    const notifData = await notifRes.json();
    record('Notifications Fetch', notifRes.ok && Array.isArray(notifData.notifications), { unreadCount: notifData.unreadCount });
  } catch (err) {
    record('Notifications Flow', false, { error: err.message });
  }

  // 11. WhatsApp Status
  try {
    const waRes = await fetch(`${BASE_URL}/api/whatsapp/status`, { headers });
    const waData = await waRes.json();
    record('WhatsApp Bot Status Endpoint', waRes.ok, { status: waData.status });
  } catch (err) {
    record('WhatsApp Bot Status Endpoint', false, { error: err.message });
  }

  // 12. Cleanup Test Data (Delete test product, test customer, test supplier)
  try {
    await fetch(`${BASE_URL}/api/products/${createdProductId}`, { method: 'DELETE', headers });
    await fetch(`${BASE_URL}/api/customers/${createdCustomerId}`, { method: 'DELETE', headers });
    await fetch(`${BASE_URL}/api/suppliers/${createdSupplierId}`, { method: 'DELETE', headers });
    record('Test Data Cleanup', true, 'Cleaned test product, customer, and supplier');
  } catch (err) {
    record('Test Data Cleanup', false, { error: err.message });
  }

  console.log('\n====================================================');
  const passedCount = results.filter(r => r.passed).length;
  console.log(`📊 Test Summary: ${passedCount}/${results.length} Tests Passed`);
  console.log('====================================================');
}

runTests();
