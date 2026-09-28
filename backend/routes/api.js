const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');

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

// Validate Promo Code (Public / Available at Checkout)
router.post('/coupons/validate', async (req, res) => {
  const { code, planName, price } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'Please enter a coupon code.' });
  }

  try {
    const cleanCode = code.trim().toUpperCase();
    const [rows] = await pool.query('SELECT * FROM promo_codes WHERE UPPER(code) = ?', [cleanCode]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid coupon code. Please verify and try again.' });
    }

    const coupon = rows[0];

    // Check expiry
    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
      return res.status(400).json({ error: 'This coupon code has expired.' });
    }

    // Check usage limits
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'This coupon usage limit has been reached.' });
    }

    // Check plan restriction
    if (coupon.planType && coupon.planType !== 'all') {
      const target = (planName || '').toLowerCase();
      if (!target.includes(coupon.planType.toLowerCase())) {
        return res.status(400).json({ error: `This coupon is only valid for ${coupon.planType.toUpperCase()} plans.` });
      }
    }

    const originalPrice = Number(price || 0);
    let discountAmount = 0;

    if (coupon.discountPercent > 0) {
      discountAmount = Math.round((originalPrice * coupon.discountPercent) / 100);
    } else if (coupon.flatDiscount > 0) {
      discountAmount = Math.min(coupon.flatDiscount, originalPrice);
    }

    const finalPrice = Math.max(1, originalPrice - discountAmount);

    res.json({
      success: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      flatDiscount: coupon.flatDiscount,
      discountAmount,
      originalPrice,
      finalPrice,
      message: `Promo code ${coupon.code} applied! You save ₹${discountAmount}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  const { id, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, imageUrl, shortCode, isLoose } = req.body;
  try {
    await pool.query(
      'INSERT INTO products (id, shopId, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, imageUrl, shortCode, isLoose) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.shopId, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode || null, imageUrl || null, shortCode || null, isLoose ? 1 : 0]
    );
  } catch (err) {
    console.warn('Fallback product insert:', err.message);
    await pool.query(
      'INSERT INTO products (id, shopId, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.shopId, name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode || null, imageUrl || null]
    );
  }
  res.json({ success: true });
});

router.put('/products/:id', async (req, res) => {
  try {
    const { name, category, brand, unit, purchasePrice, sellingPrice, mrp, gst, stock, minStock, sku, barcode, imageUrl, shortCode, isLoose } = req.body;
    
    // Fetch existing product to fill missing fields
    const [existingRows] = await pool.query('SELECT * FROM products WHERE id=? AND shopId=?', [req.params.id, req.user.shopId]);
    if (existingRows.length === 0) return res.status(404).json({ error: 'Product not found' });
    
    const p = existingRows[0];
    
    try {
      await pool.query(
        'UPDATE products SET name=?, category=?, brand=?, unit=?, purchasePrice=?, sellingPrice=?, mrp=?, gst=?, stock=?, minStock=?, sku=?, barcode=?, imageUrl=?, shortCode=?, isLoose=? WHERE id=? AND shopId=?',
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
          shortCode !== undefined ? shortCode : (p.shortCode || null),
          isLoose !== undefined ? (isLoose ? 1 : 0) : (p.isLoose ? 1 : 0),
          req.params.id, 
          req.user.shopId
        ]
      );
    } catch (err) {
      console.warn('Fallback product update:', err.message);
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
    }
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
    const { phone } = req.query;
    if (phone) {
      const clean = String(phone).replace(/\D/g, '').slice(-10);
      const [rows] = await pool.query('SELECT * FROM customers WHERE shopId = ? AND (phone = ? OR phone LIKE ?)', [req.user.shopId, clean, `%${clean}`]);
      return res.json(rows);
    }
    const [rows] = await pool.query('SELECT * FROM customers WHERE shopId = ?', [req.user.shopId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/customers', async (req, res) => {
  const { id, name, phone, address, balance, aadharNumber, photoUrl, aadharPhotoUrl } = req.body;
  try {
    await pool.query(
      'INSERT INTO customers (id, shopId, name, phone, address, balance, aadharNumber, photoUrl, aadharPhotoUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.shopId, name, phone, address, balance || 0, aadharNumber || null, photoUrl || null, aadharPhotoUrl || null]
    );
  } catch (err) {
    // If aadharPhotoUrl column not present yet, attempt alter or fallback
    try {
      await pool.query('ALTER TABLE customers ADD COLUMN aadharPhotoUrl LONGTEXT');
      await pool.query(
        'INSERT INTO customers (id, shopId, name, phone, address, balance, aadharNumber, photoUrl, aadharPhotoUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, req.user.shopId, name, phone, address, balance || 0, aadharNumber || null, photoUrl || null, aadharPhotoUrl || null]
      );
    } catch {
      await pool.query(
        'INSERT INTO customers (id, shopId, name, phone, address, balance, aadharNumber, photoUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, req.user.shopId, name, phone, address, balance || 0, aadharNumber || null, photoUrl || null]
      );
    }
  }
  res.json({ success: true });
});

router.put('/customers/:id', async (req, res) => {
  const { name, phone, address, balance, aadharNumber, photoUrl, aadharPhotoUrl } = req.body;
  try {
    try {
      await pool.query(
        'UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), balance = COALESCE(?, balance), aadharNumber = COALESCE(?, aadharNumber), photoUrl = COALESCE(?, photoUrl), aadharPhotoUrl = COALESCE(?, aadharPhotoUrl) WHERE id = ? AND shopId = ?',
        [name, phone, address, balance, aadharNumber, photoUrl, aadharPhotoUrl, req.params.id, req.user.shopId]
      );
    } catch {
      try {
        await pool.query('ALTER TABLE customers ADD COLUMN aadharPhotoUrl LONGTEXT');
      } catch {}
      await pool.query(
        'UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), balance = COALESCE(?, balance), aadharNumber = COALESCE(?, aadharNumber), photoUrl = COALESCE(?, photoUrl) WHERE id = ? AND shopId = ?',
        [name, phone, address, balance, aadharNumber, photoUrl, req.params.id, req.user.shopId]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- TRANSACTIONS (POS) ---
router.get('/transactions', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM transactions WHERE shopId = ? ORDER BY createdAt DESC LIMIT 100', [req.user.shopId]);
  const formatted = rows.map(r => {
    let dt = r.createdAt;
    if (dt instanceof Date) {
      dt = dt.toISOString();
    } else if (typeof dt === 'string' && !dt.includes('Z') && !dt.includes('+')) {
      dt = dt.replace(' ', 'T') + 'Z';
    }
    return { ...r, createdAt: dt };
  });
  res.json(formatted);
});

router.post('/transactions', async (req, res) => {
  const { id, subtotal, taxAmount, discountAmount, totalAmount, paymentMethod, customerId, items, createdAt } = req.body;
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const txCreatedAt = createdAt ? new Date(createdAt).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 1. Insert transaction
    await connection.query(
      'INSERT INTO transactions (id, shopId, subtotal, taxAmount, discountAmount, totalAmount, paymentMethod, customerId, items, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.shopId, subtotal, taxAmount, discountAmount, totalAmount, paymentMethod, customerId || null, JSON.stringify(items), txCreatedAt]
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
  const formatted = rows.map(r => {
    let dt = r.createdAt;
    if (dt instanceof Date) {
      dt = dt.toISOString();
    } else if (typeof dt === 'string' && !dt.includes('Z') && !dt.includes('+')) {
      dt = dt.replace(' ', 'T') + 'Z';
    }
    return { ...r, createdAt: dt };
  });
  res.json(formatted);
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
router.get('/shops', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [req.user.shopId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    const shop = rows[0];
    if (typeof shop.settings === 'string') {
      try { shop.settings = JSON.parse(shop.settings); } catch {}
    }
    res.json(shop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/shops', async (req, res) => {
  const { name, ownerName, phone, email, address, upiId, publicUrl, settings } = req.body;
  try {
    const serializedSettings = typeof settings === 'object' && settings !== null 
      ? JSON.stringify(settings) 
      : (settings || null);

    await pool.query(
      'UPDATE shops SET name=?, ownerName=?, phone=?, email=?, address=?, upiId=?, publicUrl=?, settings=? WHERE shopId=?',
      [name, ownerName, phone, email, address, upiId, publicUrl || null, serializedSettings, req.user.shopId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put('/shops/plan', async (req, res) => {
  const { plan, planExpiry, couponCode } = req.body;
  try {
    const p = (plan || 'free').toLowerCase();
    let normalizedPlan = 'free';
    if (p.includes('ultra')) normalizedPlan = 'ultra_pro';
    else if (p.includes('pro')) normalizedPlan = 'pro';
    else if (p.includes('plus') || p.includes('growth')) normalizedPlan = 'plus';
    else normalizedPlan = 'free';

    await pool.query(
      'UPDATE shops SET plan=?, planExpiry=? WHERE shopId=?',
      [normalizedPlan, planExpiry ? new Date(planExpiry) : null, req.user.shopId]
    );

    // Increment coupon usage if provided
    if (couponCode) {
      await pool.query('UPDATE promo_codes SET usedCount = usedCount + 1 WHERE UPPER(code) = ?', [couponCode.toUpperCase()]).catch(() => {});
    }

    res.json({ success: true, plan: normalizedPlan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- STAFF MANAGEMENT ---
router.get('/staff', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT uid, email, displayName, role FROM users WHERE shopId = ? ORDER BY role ASC, displayName ASC',
      [req.user.shopId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/staff/:uid', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only shop admin can remove staff members.' });
  }
  if (req.user.uid === req.params.uid) {
    return res.status(400).json({ error: 'You cannot remove your own admin account.' });
  }

  try {
    await pool.query('DELETE FROM users WHERE uid = ? AND shopId = ?', [req.params.uid, req.user.shopId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// Customer full passbook/ledger statement
router.get('/customers/:id/ledger', async (req, res) => {
  try {
    const [sales] = await pool.query(
      'SELECT id, totalAmount as amount, paymentMethod, items, createdAt, "sale" as entryType FROM transactions WHERE customerId = ? AND shopId = ? ORDER BY createdAt DESC',
      [req.params.id, req.user.shopId]
    );
    const [udhars] = await pool.query(
      'SELECT id, amount, type, notes, createdAt, "udhar" as entryType FROM udhar_transactions WHERE customerId = ? AND shopId = ? ORDER BY createdAt DESC',
      [req.params.id, req.user.shopId]
    );
    
    // Combine and sort by date descending
    const combined = [...sales, ...udhars].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(combined);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// --- SUPPLIERS ---
router.get('/suppliers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE shopId = ? ORDER BY name ASC', [req.user.shopId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/suppliers', async (req, res) => {
  const { id, name, phone, address, gstNumber, balance } = req.body;
  try {
    const supplierId = id || require('crypto').randomUUID();
    await pool.query(
      'INSERT INTO suppliers (id, shopId, name, phone, address, gstNumber, balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [supplierId, req.user.shopId, name, phone || null, address || null, gstNumber || null, balance || 0]
    );
    res.json({ success: true, id: supplierId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/suppliers/:id', async (req, res) => {
  const { name, phone, address, gstNumber, balance } = req.body;
  try {
    await pool.query(
      'UPDATE suppliers SET name=?, phone=?, address=?, gstNumber=?, balance=? WHERE id=? AND shopId=?',
      [name, phone, address, gstNumber, balance, req.params.id, req.user.shopId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/suppliers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM suppliers WHERE id=? AND shopId=?', [req.params.id, req.user.shopId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PURCHASES (STOCK-IN) ---
router.get('/purchases', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, s.name as supplierName, s.phone as supplierPhone 
       FROM purchases p 
       LEFT JOIN suppliers s ON p.supplierId = s.id 
       WHERE p.shopId = ? 
       ORDER BY p.date DESC 
       LIMIT 100`,
      [req.user.shopId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/purchases', async (req, res) => {
  const { id, supplierId, invoiceNumber, date, totalAmount, paidAmount, paymentStatus, items, notes } = req.body;
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const purchaseId = id || require('crypto').randomUUID();

    // 1. Insert Purchase
    await connection.query(
      'INSERT INTO purchases (id, shopId, supplierId, invoiceNumber, date, totalAmount, paidAmount, paymentStatus, items, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        purchaseId, 
        req.user.shopId, 
        supplierId || null, 
        invoiceNumber || '', 
        date || new Date(), 
        totalAmount || 0, 
        paidAmount || 0, 
        paymentStatus || 'paid', 
        JSON.stringify(items || []), 
        notes || ''
      ]
    );

    // 2. Increment stock in products and update purchase price
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.productId && item.qty) {
          if (item.purchasePrice) {
            await connection.query(
              'UPDATE products SET stock = stock + ?, purchasePrice = ? WHERE id = ? AND shopId = ?',
              [Number(item.qty), Number(item.purchasePrice), item.productId, req.user.shopId]
            );
          } else {
            await connection.query(
              'UPDATE products SET stock = stock + ? WHERE id = ? AND shopId = ?',
              [Number(item.qty), item.productId, req.user.shopId]
            );
          }
        }
      }
    }

    // 3. Update supplier balance if there is unpaid amount
    const unpaid = (Number(totalAmount) || 0) - (Number(paidAmount) || 0);
    if (supplierId && unpaid > 0) {
      await connection.query(
        'UPDATE suppliers SET balance = balance + ? WHERE id = ? AND shopId = ?',
        [unpaid, supplierId, req.user.shopId]
      );
    }

    await connection.commit();
    res.json({ success: true, id: purchaseId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;

