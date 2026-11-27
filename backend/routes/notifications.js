const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

function getAuthContext(req) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token.startsWith('sb_')) {
        const [b64] = token.slice(3).split('.');
        const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
        return { shopId: payload.shopId || req.headers['x-shop-id'] || null, uid: payload.uid, role: payload.role || 'admin' };
      }
      const decoded = jwt.verify(token, JWT_SECRET);
      return { shopId: decoded.shopId || req.headers['x-shop-id'] || null, uid: decoded.uid, role: decoded.role };
    }
  } catch {}

  const shopId = req.headers['x-shop-id'] || req.query.shopId || null;
  return { shopId, uid: null, role: null };
}

// ── 1. GET /api/notifications ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const db = await pool.getDb();
    const { shopId } = getAuthContext(req);

    const filter = shopId
      ? { $or: [{ shopId }, { shopId: null }, { shopId: 'all' }, { shopId: '' }] }
      : { $or: [{ shopId: null }, { shopId: 'all' }, { shopId: '' }] };

    const rows = pool.stripMongoIds(
      await db.collection('notifications').find(filter).sort({ createdAt: -1 }).limit(100).toArray()
    );

    let unreadCount = 0;
    const processed = rows.map((n) => {
      let isReadForShop = false;
      if (n.shopId && n.shopId !== 'all') {
        isReadForShop = Boolean(n.isRead);
      } else {
        let readByList = [];
        try {
          readByList = typeof n.readBy === 'string' ? JSON.parse(n.readBy) : (n.readBy || []);
        } catch {
          readByList = [];
        }
        isReadForShop = shopId ? readByList.includes(shopId) : Boolean(n.isRead);
      }

      if (!isReadForShop) unreadCount++;
      return { ...n, isRead: isReadForShop };
    });

    res.json({ success: true, notifications: processed, unreadCount });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. Mark all notifications as read (supports PUT & POST variants) ──────────
async function handleReadAll(req, res) {
  try {
    const db = await pool.getDb();
    const { shopId } = getAuthContext(req);

    if (!shopId) {
      await db.collection('notifications').updateMany({}, { $set: { isRead: 1 } });
      return res.json({ success: true, message: 'All marked as read' });
    }

    await db.collection('notifications').updateMany({ shopId }, { $set: { isRead: 1 } });

    const broadcasts = await db.collection('notifications')
      .find({ $or: [{ shopId: null }, { shopId: 'all' }, { shopId: '' }] })
      .toArray();

    for (const b of broadcasts) {
      let list = [];
      try {
        list = typeof b.readBy === 'string' ? JSON.parse(b.readBy) : (b.readBy || []);
      } catch {}
      if (!list.includes(shopId)) {
        list.push(shopId);
        await db.collection('notifications').updateOne({ id: b.id }, { $set: { readBy: list } });
      }
    }

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ error: err.message });
  }
}

router.put('/action/read-all', handleReadAll);
router.put('/read-all', handleReadAll);
router.post('/read-all', handleReadAll);

// ── 3. Mark single notification as read (supports PUT & POST) ─────────────────
async function handleReadOne(req, res) {
  try {
    const db = await pool.getDb();
    const { id } = req.params;
    const { shopId } = getAuthContext(req);

    const notif = await db.collection('notifications').findOne({ id });
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notif.shopId && notif.shopId !== 'all') {
      await db.collection('notifications').updateOne({ id }, { $set: { isRead: 1 } });
    } else {
      let readByList = [];
      try {
        readByList = typeof notif.readBy === 'string' ? JSON.parse(notif.readBy) : (notif.readBy || []);
      } catch {
        readByList = [];
      }

      if (shopId && !readByList.includes(shopId)) {
        readByList.push(shopId);
        await db.collection('notifications').updateOne({ id }, { $set: { readBy: readByList } });
      } else if (!shopId) {
        await db.collection('notifications').updateOne({ id }, { $set: { isRead: 1 } });
      }
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: err.message });
  }
}

router.put('/:id/read', handleReadOne);
router.post('/:id/read', handleReadOne);

// ── 4. POST /api/notifications ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const db = await pool.getDb();
    const { shopId, title, message, type, channel, actionUrl } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const id = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const doc = {
      id,
      shopId: shopId || 'all',
      title,
      message,
      type: type || 'info',
      channel: channel || 'system',
      actionUrl: actionUrl || null,
      isRead: 0,
      readBy: [],
      createdAt: new Date().toISOString()
    };

    await db.collection('notifications').insertOne(doc);
    res.json({ success: true, message: 'Notification created', id });
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 5. DELETE /api/notifications/:id ──────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const db = await pool.getDb();
    await db.collection('notifications').deleteOne({ id: req.params.id });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
