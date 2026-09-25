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
    const { email, password, displayName, shopName, ownerName, phone } = req.body;
    
    // Check if user exists
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const shopId = generateId();
    const uid = generateId();

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
    
    res.json({ token, user: { uid, email, displayName, role: 'admin', shopId } });
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
    
    res.json({ token, user });
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

module.exports = router;
