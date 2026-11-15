const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

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
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    
    const cleanEmail = email.trim().toLowerCase();
    const [users] = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'No user registered with this email. Please sign up first.' });
    }
    
    const user = users[0];
    if (!user.password) {
      return res.status(400).json({ 
        error: 'This account was registered with Google. Please use the "Continue with Google" button.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = jwt.sign({ uid: user.uid, shopId: user.shopId, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    // Remove password before sending to client
    delete user.password;
    if (typeof user.permissions === 'string') {
      try { user.permissions = JSON.parse(user.permissions); } catch(e) { user.permissions = []; }
    } else if (!user.permissions) {
      user.permissions = [];
    }
    
    let [shops] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [user.shopId]);
    let shop = shops[0] || null;
    if (!shop && user.shopId) {
      try {
        await pool.query(
          'INSERT INTO shops (shopId, name, ownerName, email, plan) VALUES (?, ?, ?, ?, ?)',
          [user.shopId, user.displayName ? `${user.displayName} Store` : 'MartGPT Store', user.displayName || 'Owner', user.email, 'free']
        );
        const [createdShops] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [user.shopId]);
        shop = createdShops[0] || null;
      } catch (err) {
        console.warn('Fallback shop auto-creation in login:', err.message);
      }
    }
    
    res.json({ token, user, shop });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Server error during login' });
  }
});

// 3. Get Current User Data (Me)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    let uid, shopId, role;
    if (token.startsWith('sb_')) {
      const payload = JSON.parse(Buffer.from(token.slice(3), 'base64').toString('utf8'));
      uid = payload.uid;
      shopId = payload.shopId;
    } else {
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        decoded = jwt.decode(token);
      }
      if (decoded) {
        uid = decoded.uid || decoded.user_id || decoded.sub;
        shopId = decoded.shopId || req.headers['x-shop-id'];
        role = decoded.role || 'admin';
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    
    let [users] = await pool.query('SELECT uid, email, displayName, role, shopId, permissions FROM users WHERE uid = ?', [uid]);
    if (!users || users.length === 0) {
      try {
        const supabase = require('../supabase');
        const { data: sbUsers } = await supabase.from('users').select('*').eq('uid', uid).limit(1);
        if (sbUsers && sbUsers.length > 0) {
          users = sbUsers;
        }
      } catch (e) {}
    }
    if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const user = users[0];
    if (typeof user.permissions === 'string') {
      try { user.permissions = JSON.parse(user.permissions); } catch(e) { user.permissions = []; }
    } else if (!user.permissions) {
      user.permissions = [];
    }
    const targetShopId = user.shopId || shopId;
    let [shops] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [targetShopId]);
    let shop = shops?.[0] || null;

    if (!shop) {
      try {
        const supabase = require('../supabase');
        const { data: sbShops } = await supabase.from('shops').select('*').eq('shopId', targetShopId).limit(1);
        if (sbShops && sbShops.length > 0) {
          shop = sbShops[0];
        }
      } catch (e) {}
    }
    
    res.json({ user, shop });
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

    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = displayName || cleanEmail.split('@')[0];

    // 1. Check if user already exists by exact Firebase UID
    let [users] = await pool.query('SELECT * FROM users WHERE uid = ?', [uid]);

    // 2. If not found by UID, check by normalized email
    if (users.length === 0) {
      const [byEmail] = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      if (byEmail.length > 0) {
        users = byEmail;
        // User has an older ID; attempt safe update of primary key
        try {
          await pool.query('UPDATE users SET uid = ? WHERE uid = ?', [uid, byEmail[0].uid]);
          users[0].uid = uid;
        } catch (e) {
          console.warn('Could not update user UID to Firebase UID:', e.message);
        }
      }
    }

    // Existing user found
    if (users.length > 0) {
      const user = users[0];
      let [shops] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [user.shopId]);
      
      // If user is admin but shop is missing, create a default shop
      if (shops.length === 0 && user.role === 'admin') {
        const fallbackShopId = user.shopId || generateId();
        await pool.query(
          'INSERT INTO shops (shopId, name, ownerName, email, plan) VALUES (?, ?, ?, ?, ?)',
          [fallbackShopId, shopName || 'My Kirana Store', ownerName || cleanDisplayName, cleanEmail, 'free']
        );
        if (!user.shopId) {
          await pool.query('UPDATE users SET shopId = ? WHERE uid = ?', [fallbackShopId, user.uid]);
          user.shopId = fallbackShopId;
        }
        [shops] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [fallbackShopId]);
      }

      const token = jwt.sign({ uid: user.uid, shopId: user.shopId, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      delete user.password;
      return res.json({ token, user, shop: shops[0] || null });
    }

    // 3. Brand New User in MySQL:
    if (role === 'cashier' || joinShopId) {
      // Cashier flow: Join existing shop
      const targetShopId = (joinShopId || '').trim();
      if (!targetShopId) {
        return res.status(400).json({ error: 'Shop ID is required to join as cashier.' });
      }
      const [existingShop] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [targetShopId]);
      if (existingShop.length === 0) {
        return res.status(404).json({ error: 'Shop not found with provided Shop ID.' });
      }

      const targetShop = existingShop[0];
      await pool.query(
        'INSERT INTO users (uid, email, displayName, role, shopId) VALUES (?, ?, ?, ?, ?)',
        [uid, cleanEmail, cleanDisplayName, 'cashier', targetShop.shopId]
      );

      const token = jwt.sign({ uid, shopId: targetShop.shopId, role: 'cashier' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        token,
        user: { uid, email: cleanEmail, displayName: cleanDisplayName, role: 'cashier', shopId: targetShop.shopId },
        shop: targetShop
      });
    } else {
      // Admin flow: Create new Shop and Admin User
      const newShopId = generateId();
      await pool.query(
        'INSERT INTO shops (shopId, name, ownerName, phone, email, plan) VALUES (?, ?, ?, ?, ?, ?)',
        [newShopId, shopName || 'My Kirana Store', ownerName || cleanDisplayName, phone || '', cleanEmail, 'free']
      );

      await pool.query(
        'INSERT INTO users (uid, email, displayName, role, shopId) VALUES (?, ?, ?, ?, ?)',
        [uid, cleanEmail, cleanDisplayName, 'admin', newShopId]
      );

      const token = jwt.sign({ uid, shopId: newShopId, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      const shop = { 
        shopId: newShopId, 
        name: shopName || 'My Kirana Store', 
        ownerName: ownerName || cleanDisplayName, 
        phone: phone || '', 
        email: cleanEmail, 
        plan: 'free' 
      };

      return res.json({
        token,
        user: { uid, email: cleanEmail, displayName: cleanDisplayName, role: 'admin', shopId: newShopId },
        shop
      });
    }
  } catch (error) {
    console.error('Firebase sync error:', {
      message: error?.message,
      code: error?.code,
      sqlMessage: error?.sqlMessage
    });
    
    let msg = error?.sqlMessage || error?.message || 'Server error during Firebase sync';
    if (error?.code === 'ECONNREFUSED') {
      msg = 'Database connection failed (ECONNREFUSED). Please verify MySQL database server is running.';
    } else if (error?.code === 'ER_ACCESS_DENIED_ERROR') {
      msg = 'Database access denied. Please verify DB_USER and DB_PASSWORD credentials in .env.';
    }
    
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
