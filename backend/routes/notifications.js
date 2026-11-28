const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, verifyBearerToken, isSuperAdminUser, getMasterKey } = require('../middleware/auth');

function isSuperAdminRequest(req) {
  const rawKey = req.headers['x-superadmin-key'] || req.headers['x-master-key'];
  if (rawKey && String(rawKey).trim() === getMasterKey()) {
    return true;
  }
  const user = verifyBearerToken(req);
  return isSuperAdminUser(user);
}

// ── 1. GET /api/notifications ─────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await pool.getDb();
    const shopId = req.user.shopId;

    const filter = { $or: [{ shopId }, { shopId: 'all' }] };

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
        isReadForShop = readByList.includes(shopId);
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
    const shopId = req.user.shopId;

    await Promise.all([
      db.collection('notifications').updateMany({ shopId }, { $set: { isRead: 1 } }),
      db.collection('notifications').updateMany({ shopId: 'all' }, { $addToSet: { readBy: shopId } })
    ]);

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ error: err.message });
  }
}

router.put('/action/read-all', requireAuth, handleReadAll);
router.put('/read-all', requireAuth, handleReadAll);
router.post('/read-all', requireAuth, handleReadAll);

// ── 3. Mark single notification as read (supports PUT & POST) ─────────────────
async function handleReadOne(req, res) {
  try {
    const db = await pool.getDb();
    const { id } = req.params;
    const shopId = req.user.shopId;

    const notif = await db.collection('notifications').findOne({ id });
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notif.shopId && notif.shopId !== 'all') {
      if (notif.shopId !== shopId) {
        return res.status(403).json({ error: 'Forbidden: Notification belongs to another store' });
      }
      await db.collection('notifications').updateOne({ id, shopId }, { $set: { isRead: 1 } });
    } else if (notif.shopId === 'all') {
      await db.collection('notifications').updateOne({ id }, { $addToSet: { readBy: shopId } });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: err.message });
  }
}

router.put('/:id/read', requireAuth, handleReadOne);
router.post('/:id/read', requireAuth, handleReadOne);

// ── 4. POST /api/notifications (Super Admin or scoped Store Admin) ────────────
router.post('/', async (req, res) => {
  try {
    const superAdmin = isSuperAdminRequest(req);
    const user = superAdmin ? null : verifyBearerToken(req);

    if (!superAdmin && !user) {
      return res.status(401).json({ error: 'Unauthorized: Valid session or Super Admin credentials required' });
    }

    const db = await pool.getDb();
    const { shopId, title, message, type, channel, actionUrl } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    let targetShopId;
    if (superAdmin) {
      targetShopId = shopId || 'all';
    } else {
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only store admins can create notifications' });
      }
      if (shopId && shopId !== user.shopId) {
        return res.status(403).json({ error: 'Cannot create notifications for another store' });
      }
      targetShopId = user.shopId;
    }

    const id = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const doc = {
      id,
      shopId: targetShopId,
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
    const superAdmin = isSuperAdminRequest(req);
    const user = superAdmin ? null : verifyBearerToken(req);

    if (!superAdmin && !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await pool.getDb();
    const filter = superAdmin ? { id: req.params.id } : { id: req.params.id, shopId: user.shopId };
    const result = await db.collection('notifications').deleteOne(filter);
    if (!result.deletedCount) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
