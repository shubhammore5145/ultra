const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
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

// Helper to generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// 1. Sign Up
router.post('/signup', async (req, res) => {
  try {
    const { email, password, displayName, shopName, ownerName, phone, role, shopId: joinShopId } = req.body;
    
    // Check if user exists
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const uid = generateId();

    if (role === 'cashier' || joinShopId) {
      // Cashier flow: Join an existing shop
      if (!joinShopId) {
        return res.status(400).json({ error: 'Shop ID is required to join as cashier.' });
      }

      const [existingShop] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [joinShopId]);
      if (existingShop.length === 0) {
        return res.status(404).json({ error: 'Shop not found. Please enter a valid Shop ID.' });
      }

      const targetShop = existingShop[0];

      // Create Staff User
      await pool.query(
        'INSERT INTO users (uid, email, password, displayName, role, shopId) VALUES (?, ?, ?, ?, ?, ?)',
        [uid, email, hashedPassword, displayName, 'cashier', targetShop.shopId]
      );

      // Generate token
      const token = jwt.sign({ uid, shopId: targetShop.shopId, role: 'cashier' }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { uid, email, displayName, role: 'cashier', shopId: targetShop.shopId }, shop: targetShop });
    } else {
      // Admin flow: Create new Shop and Admin
      const shopId = generateId();

      // Create Shop
      await pool.query(
        'INSERT INTO shops (shopId, name, ownerName, phone, email, plan) VALUES (?, ?, ?, ?, ?, ?)',
        [shopId, shopName || 'My Shop', ownerName || displayName, phone || '', email, 'free']
      );

      // Create User
      await pool.query(
        'INSERT INTO users (uid, email, password, displayName, role, shopId) VALUES (?, ?, ?, ?, ?, ?)',
        [uid, email, hashedPassword, displayName, 'admin', shopId]
      );

      // Generate token
      const token = jwt.sign({ uid, shopId, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      const shop = { shopId, name: shopName || 'My Shop', ownerName: ownerName || displayName, phone: phone || '', email, plan: 'free' };
      res.json({ token, user: { uid, email, displayName, role: 'admin', shopId }, shop });
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// 2. Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'User not found' });
    }
    
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ uid: user.uid, shopId: user.shopId, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    // Remove password before sending to client
    delete user.password;
    
    const [shops] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [user.shopId]);
    
    res.json({ token, user, shop: shops[0] || null });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// 3. Get Current User Data (Me)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const [users] = await pool.query('SELECT uid, email, displayName, role, shopId FROM users WHERE uid = ?', [decoded.uid]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const [shops] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [decoded.shopId]);
    
    res.json({ user: users[0], shop: shops[0] || null });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 4. Firebase Auth Sync (Authenticate via Firebase, persist & authorize via MySQL)
router.post('/firebase-sync', async (req, res) => {
  try {
    const { uid, email, displayName, role, shopId: joinShopId, shopName, ownerName, phone } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ error: 'Firebase UID and email are required' });
    }

    // Check if user already exists in MySQL (by uid or email)
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE uid = ? OR email = ?', [uid, email]);

    if (existingUsers.length > 0) {
      const user = existingUsers[0];
      // If the UID in MySQL is different (e.g. from previous local signup), update it to Firebase UID
      if (user.uid !== uid) {
        await pool.query('UPDATE users SET uid = ? WHERE email = ?', [uid, email]);
        user.uid = uid;
      }
      
      const token = jwt.sign({ uid: user.uid, shopId: user.shopId, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      const [shops] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [user.shopId]);
      delete user.password;
      return res.json({ token, user, shop: shops[0] || null });
    }

    // New User in MySQL:
    if (role === 'cashier' || joinShopId) {
      // Cashier flow: Join existing shop
      if (!joinShopId) {
        return res.status(400).json({ error: 'Shop ID is required to join as cashier.' });
      }
      const [existingShop] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [joinShopId]);
      if (existingShop.length === 0) {
        return res.status(404).json({ error: 'Shop not found with provided Shop ID.' });
      }

      const targetShop = existingShop[0];
      await pool.query(
        'INSERT INTO users (uid, email, displayName, role, shopId) VALUES (?, ?, ?, ?, ?)',
        [uid, email, displayName || email.split('@')[0], 'cashier', targetShop.shopId]
      );

      const token = jwt.sign({ uid, shopId: targetShop.shopId, role: 'cashier' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        token,
        user: { uid, email, displayName: displayName || email.split('@')[0], role: 'cashier', shopId: targetShop.shopId },
        shop: targetShop
      });
    } else {
      // Admin flow: Create new Shop
      const newShopId = generateId();
      await pool.query(
        'INSERT INTO shops (shopId, name, ownerName, phone, email, plan) VALUES (?, ?, ?, ?, ?, ?)',
        [newShopId, shopName || 'My Kirana Store', ownerName || displayName || 'Shop Owner', phone || '', email, 'free']
      );

      await pool.query(
        'INSERT INTO users (uid, email, displayName, role, shopId) VALUES (?, ?, ?, ?, ?)',
        [uid, email, displayName || email.split('@')[0], 'admin', newShopId]
      );

      const token = jwt.sign({ uid, shopId: newShopId, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      const shop = { shopId: newShopId, name: shopName || 'My Kirana Store', ownerName: ownerName || displayName, phone: phone || '', email, plan: 'free' };
      return res.json({
        token,
        user: { uid, email, displayName: displayName || email.split('@')[0], role: 'admin', shopId: newShopId },
        shop
      });
    }
  } catch (error) {
    console.error('Firebase sync error:', error);
    res.status(500).json({ error: error.message || 'Server error during Firebase sync' });
  }
});

module.exports = router;
