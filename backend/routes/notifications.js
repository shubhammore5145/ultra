const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

// Helper to extract shopId and userId from request
function getAuthContext(req) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token.startsWith('sb_')) {
        const payload = JSON.parse(Buffer.from(token.slice(3), 'base64').toString('utf8'));
        return { shopId: payload.shopId || req.headers['x-shop-id'] || null, uid: payload.uid, role: payload.role || 'admin' };
      }
      const decoded = jwt.verify(token, JWT_SECRET);
      return { shopId: decoded.shopId || req.headers['x-shop-id'] || null, uid: decoded.uid, role: decoded.role };
    }
  } catch (err) {}
  
  // Fallback to headers or query
  const shopId = req.headers['x-shop-id'] || req.query.shopId || null;
  return { shopId, uid: null, role: null };
}

// ── 1. GET /api/notifications ─────────────────────────────────────────────────
// Get all notifications for current shop (global broadcasts + shop-specific)
router.get('/', async (req, res) => {
  try {
    const { shopId } = getAuthContext(req);
    
    // Ensure table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(64) PRIMARY KEY,
          shopId VARCHAR(64) NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'info',
          channel VARCHAR(50) DEFAULT 'system',
          actionUrl VARCHAR(255) NULL,
          isRead TINYINT(1) DEFAULT 0,
          readBy TEXT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {}

    let rows = [];
    if (shopId) {
      const [results] = await pool.query(
        `SELECT * FROM notifications 
         WHERE shopId = ? OR shopId IS NULL OR shopId = 'all' OR shopId = '' 
         ORDER BY createdAt DESC LIMIT 100`,
        [shopId]
      );
      rows = results || [];
    } else {
      const [results] = await pool.query(
        `SELECT * FROM notifications 
         WHERE shopId IS NULL OR shopId = 'all' OR shopId = '' 
         ORDER BY createdAt DESC LIMIT 100`
      );
      rows = results || [];
    }

    // Process notifications and calculate unread count
    let unreadCount = 0;
    const processed = rows.map(n => {
      let isReadForShop = false;
      
      if (n.shopId && n.shopId !== 'all') {
        isReadForShop = Boolean(n.isRead);
      } else {
        // Broadcast message: check readBy array
        let readByList = [];
        try {
          readByList = typeof n.readBy === 'string' ? JSON.parse(n.readBy) : (n.readBy || []);
        } catch {
          readByList = [];
        }
        isReadForShop = shopId ? readByList.includes(shopId) : Boolean(n.isRead);
      }

      if (!isReadForShop) unreadCount++;

      return {
        ...n,
        isRead: isReadForShop
      };
    });

    res.json({
      success: true,
      notifications: processed,
      unreadCount
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. PUT /api/notifications/:id/read ────────────────────────────────────────
// Mark a notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { shopId } = getAuthContext(req);

    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const notif = rows[0];

    if (notif.shopId && notif.shopId !== 'all') {
      await pool.query('UPDATE notifications SET isRead = 1 WHERE id = ?', [id]);
    } else {
      // Global broadcast: append shopId to readBy list
      let readByList = [];
      try {
        readByList = typeof notif.readBy === 'string' ? JSON.parse(notif.readBy) : (notif.readBy || []);
      } catch {
        readByList = [];
      }

      if (shopId && !readByList.includes(shopId)) {
        readByList.push(shopId);
        await pool.query('UPDATE notifications SET readBy = ? WHERE id = ?', [JSON.stringify(readByList), id]);
      } else if (!shopId) {
        await pool.query('UPDATE notifications SET isRead = 1 WHERE id = ?', [id]);
      }
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 3. PUT /api/notifications/read-all ────────────────────────────────────────
// Mark all notifications as read for current shop
router.put('/action/read-all', async (req, res) => {
  try {
    const { shopId } = getAuthContext(req);
    if (!shopId) {
      await pool.query('UPDATE notifications SET isRead = 1');
      return res.json({ success: true, message: 'All marked as read' });
    }

    // Mark shop-specific
    await pool.query('UPDATE notifications SET isRead = 1 WHERE shopId = ?', [shopId]);

    // Mark broadcasts
    const [broadcasts] = await pool.query(`SELECT id, readBy FROM notifications WHERE shopId IS NULL OR shopId = 'all' OR shopId = ''`);
    for (const b of broadcasts) {
      let list = [];
      try { list = typeof b.readBy === 'string' ? JSON.parse(b.readBy) : (b.readBy || []); } catch {}
      if (!list.includes(shopId)) {
        list.push(shopId);
        await pool.query('UPDATE notifications SET readBy = ? WHERE id = ?', [JSON.stringify(list), b.id]);
      }
    }

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 4. POST /api/notifications ────────────────────────────────────────────────
// Create a new notification (system, broadcast, or admin)
router.post('/', async (req, res) => {
  try {
    const { shopId, title, message, type, channel, actionUrl } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const id = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const targetShopId = shopId || 'all';

    await pool.query(
      `INSERT INTO notifications (id, shopId, title, message, type, channel, actionUrl, isRead, readBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, '[]', NOW())`,
      [id, targetShopId, title, message, type || 'info', channel || 'system', actionUrl || null]
    );

    res.json({
      success: true,
      message: 'Notification created',
      id
    });
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 5. DELETE /api/notifications/:id ──────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
