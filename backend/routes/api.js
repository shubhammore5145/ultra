const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Shubham16@',
  database: process.env.DB_NAME || 'nayashi_kirana',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

// Middleware to verify token and inject shopId
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { uid, shopId, role }
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- PUBLIC ROUTES (No Auth Required) ---
router.get('/public/receipt/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, s.name as shopName, s.phone as shopPhone, s.address as shopAddress, 
              c.name as customerName, c.phone as customerPhone 
       FROM transactions t 
       LEFT JOIN shops s ON t.shopId = s.shopId 
       LEFT JOIN customers c ON t.customerId = c.id 
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Receipt not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.use(authMiddleware);

// --- PRODUCTS ---
router.get('/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE shopId = ?', [req.user.shopId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/products', async (req, res) => {
  const { id, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, imageUrl } = req.body;
  await pool.query(
    'INSERT INTO products (id, shopId, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.shopId, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, imageUrl || null]
  );
  res.json({ success: true });
});

router.put('/products/:id', async (req, res) => {
  try {
    const { name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, imageUrl } = req.body;
    
    // Fetch existing product to fill missing fields
    const [existingRows] = await pool.query('SELECT * FROM products WHERE id=? AND shopId=?', [req.params.id, req.user.shopId]);
    if (existingRows.length === 0) return res.status(404).json({ error: 'Product not found' });
    
    const p = existingRows[0];
    
    await pool.query(
      'UPDATE products SET name=?, category=?, brand=?, unit=?, purchasePrice=?, sellingPrice=?, mrp=?, gst=?, stock=?, minStock=?, sku=?, barcode=?, imageUrl=? WHERE id=? AND shopId=?',
      [
        name ?? p.name, 
        category ?? p.category, 
        brand ?? p.brand, 
        unit ?? p.unit, 
        purchasePrice ?? p.purchasePrice, 
        sellingPrice ?? p.sellingPrice, 
        mrp ?? p.mrp, 
        gst ?? p.gst, 
        stock ?? p.stock, 
        minStock ?? p.minStock, 
        sku ?? p.sku, 
        barcode ?? p.barcode, 
        imageUrl ?? p.imageUrl, 
        req.params.id, 
        req.user.shopId
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/products/:id', async (req, res) => {
  await pool.query('DELETE FROM products WHERE id=? AND shopId=?', [req.params.id, req.user.shopId]);
  res.json({ success: true });
});

// --- CUSTOMERS ---
router.get('/customers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE shopId = ?', [req.user.shopId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/customers', async (req, res) => {
  const { id, name, phone, address, balance, aadharNumber, photoUrl } = req.body;
  await pool.query(
    'INSERT INTO customers (id, shopId, name, phone, address, balance, aadharNumber, photoUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.shopId, name, phone, address, balance || 0, aadharNumber || null, photoUrl || null]
  );
  res.json({ success: true });
});

// --- TRANSACTIONS (POS) ---
router.get('/transactions', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM transactions WHERE shopId = ? ORDER BY createdAt DESC LIMIT 100', [req.user.shopId]);
  res.json(rows);
});

router.post('/transactions', async (req, res) => {
  const { id, subtotal, taxAmount, discountAmount, totalAmount, paymentMethod, customerId, items } = req.body;
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    // 1. Insert transaction
    await connection.query(
      'INSERT INTO transactions (id, shopId, subtotal, taxAmount, discountAmount, totalAmount, paymentMethod, customerId, items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.shopId, subtotal, taxAmount, discountAmount, totalAmount, paymentMethod, customerId || null, JSON.stringify(items)]
    );

    // 2. Reduce stock for items
    for (const item of items) {
      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND shopId = ?',
        [item.qty, item.id, req.user.shopId]
      );
    }

    const loyaltyPointsEarned = Math.floor(totalAmount / 100);

    // 3. Update customer if Udhar
    let udharAmountToAdd = 0;
    if (paymentMethod === 'udhar') {
      udharAmountToAdd = totalAmount;
    } else if (paymentMethod === 'split' && req.body.splitAmounts?.udhar) {
      udharAmountToAdd = req.body.splitAmounts.udhar;
    }

    if (udharAmountToAdd > 0 && customerId) {
      await connection.query(
        'UPDATE customers SET balance = balance + ?, totalSpent = totalSpent + ?, visits = visits + 1, loyaltyPoints = loyaltyPoints + ? WHERE id = ? AND shopId = ?',
        [udharAmountToAdd, totalAmount, loyaltyPointsEarned, customerId, req.user.shopId]
      );
      
      // Add Udhar transaction log
      const crypto = require('crypto');
      await connection.query(
        'INSERT INTO udhar_transactions (id, shopId, customerId, amount, type, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), req.user.shopId, customerId, udharAmountToAdd, 'credit', `Split checkout #${id.slice(-6).toUpperCase()}`]
      );
    } else if (customerId) {
      await connection.query(
        'UPDATE customers SET totalSpent = totalSpent + ?, visits = visits + 1, loyaltyPoints = loyaltyPoints + ? WHERE id = ? AND shopId = ?',
        [totalAmount, loyaltyPointsEarned, customerId, req.user.shopId]
      );
    }
    
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// --- EXPENSES ---
router.get('/expenses', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM expenses WHERE shopId = ? ORDER BY date DESC', [req.user.shopId]);
  res.json(rows);
});

router.post('/expenses', async (req, res) => {
  const { id, category, amount, description, date } = req.body;
  await pool.query(
    'INSERT INTO expenses (id, shopId, category, amount, description, date, addedBy) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.shopId, category, amount, description, date, req.user.uid]
  );
  res.json({ success: true });
});

// --- UDHAR TRANSACTIONS ---
router.get('/udhar', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM udhar_transactions WHERE shopId = ? ORDER BY createdAt DESC', [req.user.shopId]);
  res.json(rows);
});

router.post('/udhar', async (req, res) => {
  const { id, customerId, amount, type, notes } = req.body;
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    await connection.query(
      'INSERT INTO udhar_transactions (id, shopId, customerId, amount, type, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.user.shopId, customerId, amount, type, notes]
    );

    if (type === 'payment') {
      await connection.query('UPDATE customers SET balance = balance - ? WHERE id = ? AND shopId = ?', [amount, customerId, req.user.shopId]);
    } else {
      await connection.query('UPDATE customers SET balance = balance + ? WHERE id = ? AND shopId = ?', [amount, customerId, req.user.shopId]);
    }
    
    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// --- SHOPS ---
router.put('/shops', async (req, res) => {
  const { name, ownerName, phone, email, address, upiId } = req.body;
  try {
    await pool.query(
      'UPDATE shops SET name=?, ownerName=?, phone=?, email=?, address=?, upiId=? WHERE shopId=?',
      [name, ownerName, phone, email, address, upiId, req.user.shopId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/shops/plan', async (req, res) => {
  const { plan } = req.body;
  try {
    await pool.query('UPDATE shops SET plan=? WHERE shopId=?', [plan, req.user.shopId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CUSTOMERS UPDATE ---
router.put('/customers/:id', async (req, res) => {
  const { name, phone, address, aadharNumber, photoUrl } = req.body;
  try {
    await pool.query(
      'UPDATE customers SET name=?, phone=?, address=?, aadharNumber=COALESCE(?, aadharNumber), photoUrl=COALESCE(?, photoUrl) WHERE id=? AND shopId=?',
      [name, phone, address, aadharNumber || null, photoUrl || null, req.params.id, req.user.shopId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- EXPENSES DELETE ---
router.delete('/expenses/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM expenses WHERE id=? AND shopId=?', [req.params.id, req.user.shopId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
