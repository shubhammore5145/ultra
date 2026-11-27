const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

// Helper to generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

function normalizePermissions(perms) {
  if (Array.isArray(perms)) return perms;
  if (typeof perms === 'string' && perms.trim()) {
    try {
      const parsed = JSON.parse(perms);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// 1. Sign Up
router.post('/signup', async (req, res) => {
  try {
    const db = await pool.getDb();
    const { email, password, displayName, shopName, ownerName, phone, role, shopId: joinShopId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = new RegExp(`^${pool.escapeRegex(cleanEmail)}$`, 'i');

    const existing = await db.collection('users').findOne({ email: { $regex: emailRegex } });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const uid = generateId();
    const nowIso = new Date().toISOString();

    if (role === 'cashier' || joinShopId) {
      if (!joinShopId) {
        return res.status(400).json({ error: 'Shop ID is required to join as cashier.' });
      }

      const targetShop = pool.stripMongoId(
        await db.collection('shops').findOne({ shopId: String(joinShopId).trim() })
      );
      if (!targetShop) {
        return res.status(404).json({ error: 'Shop not found. Please enter a valid Shop ID.' });
      }

      const newUser = {
        uid,
        email: cleanEmail,
        password: hashedPassword,
        displayName: displayName || cleanEmail.split('@')[0],
        role: 'cashier',
        shopId: targetShop.shopId,
        permissions: [],
        createdAt: nowIso
      };
      await db.collection('users').insertOne({ ...newUser });

      const token = jwt.sign({ uid, shopId: targetShop.shopId, role: 'cashier' }, JWT_SECRET, { expiresIn: '7d' });
      const { password: _pw, ...safeUser } = newUser;
      res.json({ token, user: safeUser, shop: targetShop });
    } else {
      const shopId = generateId();

      const newShop = {
        shopId,
        name: shopName || 'My Shop',
        ownerName: ownerName || displayName || cleanEmail.split('@')[0],
        phone: phone || '',
        email: cleanEmail,
        plan: 'free',
        settings: { invoicePrefix: 'INV', currency: '₹', taxEnabled: true },
        createdAt: nowIso
      };
      await db.collection('shops').insertOne({ ...newShop });

      const newUser = {
        uid,
        email: cleanEmail,
        password: hashedPassword,
        displayName: displayName || cleanEmail.split('@')[0],
        role: 'admin',
        shopId,
        permissions: [],
        createdAt: nowIso
      };
      await db.collection('users').insertOne({ ...newUser });

      const token = jwt.sign({ uid, shopId, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      const { password: _pw, ...safeUser } = newUser;
      res.json({ token, user: safeUser, shop: newShop });
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// 2. Login
router.post('/login', async (req, res) => {
  try {
    const db = await pool.getDb();
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = new RegExp(`^${pool.escapeRegex(cleanEmail)}$`, 'i');
    const userDoc = await db.collection('users').findOne({ email: { $regex: emailRegex } });

    if (!userDoc) {
      return res.status(400).json({ error: 'No user registered with this email. Please sign up first.' });
    }

    if (!userDoc.password) {
      return res.status(400).json({
        error: 'This account was registered with Google. Please use the "Continue with Google" button.'
      });
    }

    const isMatch = await bcrypt.compare(password, userDoc.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect password. Please try again.' });
    }

    const user = pool.stripMongoId(userDoc);
    delete user.password;
    user.permissions = normalizePermissions(user.permissions);

    const token = jwt.sign({ uid: user.uid, shopId: user.shopId, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    let shop = pool.stripMongoId(await db.collection('shops').findOne({ shopId: user.shopId }));
    if (!shop && user.shopId) {
      try {
        const fallbackShop = {
          shopId: user.shopId,
          name: user.displayName ? `${user.displayName} Store` : 'MartGPT Store',
          ownerName: user.displayName || 'Owner',
          email: user.email,
          plan: 'free',
          settings: { invoicePrefix: 'INV', currency: '₹', taxEnabled: true },
          createdAt: new Date().toISOString()
        };
        await db.collection('shops').insertOne({ ...fallbackShop });
        shop = fallbackShop;
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
    const db = await pool.getDb();
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    let uid, shopId;
    if (token.startsWith('sb_')) {
      const [payloadB64] = token.slice(3).split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
      uid = payload.uid;
      shopId = payload.shopId;
    } else {
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        decoded = jwt.decode(token);
      }
      if (decoded) {
        uid = decoded.uid || decoded.user_id || decoded.sub;
        shopId = decoded.shopId || req.headers['x-shop-id'];
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    const userDoc = await db.collection('users').findOne(
      { uid },
      { projection: { _id: 0, password: 0 } }
    );
    if (!userDoc) return res.status(404).json({ error: 'User not found' });

    userDoc.permissions = normalizePermissions(userDoc.permissions);
    const targetShopId = userDoc.shopId || shopId;
    const shop = pool.stripMongoId(await db.collection('shops').findOne({ shopId: targetShopId }));

    res.json({ user: userDoc, shop: shop || null });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 4. Firebase Auth Sync
router.post('/firebase-sync', async (req, res) => {
  try {
    const db = await pool.getDb();
    const { uid, email, displayName, role, shopId: joinShopId, shopName, ownerName, phone } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ error: 'Firebase UID and email are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = displayName || cleanEmail.split('@')[0];
    const emailRegex = new RegExp(`^${pool.escapeRegex(cleanEmail)}$`, 'i');

    // 1. Check by UID first
    let userDoc = await db.collection('users').findOne({ uid });

    // 2. Check by normalized email if not found by UID
    if (!userDoc) {
      const byEmail = await db.collection('users').findOne({ email: { $regex: emailRegex } });
      if (byEmail) {
        userDoc = byEmail;
        try {
          await db.collection('users').updateOne({ _id: byEmail._id }, { $set: { uid } });
          userDoc.uid = uid;
        } catch (e) {
          console.warn('Could not update user UID to Firebase UID:', e.message);
        }
      }
    }

    if (userDoc) {
      const user = pool.stripMongoId(userDoc);
      delete user.password;
      user.permissions = normalizePermissions(user.permissions);

      let shop = pool.stripMongoId(await db.collection('shops').findOne({ shopId: user.shopId }));

      if (!shop && user.role === 'admin') {
        const fallbackShopId = user.shopId || generateId();
        const newShop = {
          shopId: fallbackShopId,
          name: shopName || 'My Kirana Store',
          ownerName: ownerName || cleanDisplayName,
          email: cleanEmail,
          plan: 'free',
          settings: { invoicePrefix: 'INV', currency: '₹', taxEnabled: true },
          createdAt: new Date().toISOString()
        };
        await db.collection('shops').insertOne({ ...newShop });
        if (!user.shopId) {
          await db.collection('users').updateOne({ uid: user.uid }, { $set: { shopId: fallbackShopId } });
          user.shopId = fallbackShopId;
        }
        shop = newShop;
      }

      const token = jwt.sign({ uid: user.uid, shopId: user.shopId, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user, shop: shop || null });
    }

    // 3. Brand New User
    const nowIso = new Date().toISOString();
    if (role === 'cashier' || joinShopId) {
      const targetShopId = (joinShopId || '').trim();
      if (!targetShopId) {
        return res.status(400).json({ error: 'Shop ID is required to join as cashier.' });
      }
      const targetShop = pool.stripMongoId(await db.collection('shops').findOne({ shopId: targetShopId }));
      if (!targetShop) {
        return res.status(404).json({ error: 'Shop not found with provided Shop ID.' });
      }

      const newUser = {
        uid,
        email: cleanEmail,
        displayName: cleanDisplayName,
        role: 'cashier',
        shopId: targetShop.shopId,
        permissions: [],
        createdAt: nowIso
      };
      await db.collection('users').insertOne({ ...newUser });

      const token = jwt.sign({ uid, shopId: targetShop.shopId, role: 'cashier' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: newUser, shop: targetShop });
    } else {
      const newShopId = generateId();
      const newShop = {
        shopId: newShopId,
        name: shopName || 'My Kirana Store',
        ownerName: ownerName || cleanDisplayName,
        phone: phone || '',
        email: cleanEmail,
        plan: 'free',
        settings: { invoicePrefix: 'INV', currency: '₹', taxEnabled: true },
        createdAt: nowIso
      };
      await db.collection('shops').insertOne({ ...newShop });

      const newUser = {
        uid,
        email: cleanEmail,
        displayName: cleanDisplayName,
        role: 'admin',
        shopId: newShopId,
        permissions: [],
        createdAt: nowIso
      };
      await db.collection('users').insertOne({ ...newUser });

      const token = jwt.sign({ uid, shopId: newShopId, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: newUser, shop: newShop });
    }
  } catch (error) {
    console.error('Firebase sync error:', error);
    res.status(500).json({ error: error.message || 'Server error during Firebase sync' });
  }
});

module.exports = router;
