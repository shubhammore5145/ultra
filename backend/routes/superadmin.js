const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';
const MASTER_KEY = process.env.SUPERADMIN_KEY || '5145';

// Whitelist of verified Super Admin email addresses
const SUPERADMIN_IDENTIFIERS = [
  'shubham45mgm@gmail.com',
  'shubhamnmore16@gmail.com',
  'shubhamvmore12@gmail.com'
];

// Super Admin Authorization Middleware
const superAdminMiddleware = async (req, res, next) => {
  try {
    // 1. Check Master Key Header or Query Param
    const rawKey = req.headers['x-superadmin-key'] || req.query.key || req.headers['x-master-key'];
    if (rawKey) {
      const keyStr = String(rawKey).trim();
      if (keyStr === MASTER_KEY) {
        req.isSuperAdmin = true;
        return next();
      }
    }

    // 2. Check JWT Auth Token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Look up user in database
        const [users] = await pool.query('SELECT uid, email, displayName, role FROM users WHERE uid = ?', [decoded.uid]).catch(() => [[]]);
        const user = users?.[0] || decoded;
        const isAuthorized = 
          user.role === 'super_admin' ||
          (user.email && SUPERADMIN_IDENTIFIERS.includes(user.email.toLowerCase()));

        if (isAuthorized) {
          req.user = user;
          req.isSuperAdmin = true;
          return next();
        }
      } catch (e) {}
    }

    // If no valid auth provided
    return res.status(401).json({ error: 'Super Admin: Unauthorized access. Valid master key or admin privileges required.' });
  } catch (err) {
    console.error('Super Admin Auth Error:', err.message);
    res.status(401).json({ error: 'Super Admin authentication failed: ' + err.message });
  }
};

router.use(superAdminMiddleware);

// ── 1. GET /api/superadmin/stats ──────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    // Total shops
    const [[{ totalShops }]] = await pool.query('SELECT COUNT(*) as totalShops FROM shops');

    // Total users
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) as totalUsers FROM users');

    // Total products
    const [[{ totalProducts }]] = await pool.query('SELECT COUNT(*) as totalProducts FROM products');

    // Total transactions & total sales
    let totalTransactions = 0;
    let totalSalesVolume = 0;
    try {
      const [[txRes]] = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(totalAmount), 0) as totalSales FROM transactions');
      totalTransactions = txRes?.count || 0;
      totalSalesVolume = Number(txRes?.totalSales || 0);
    } catch {}

    // Plan counts
    const [planRows] = await pool.query(`
      SELECT 
        LOWER(COALESCE(plan, 'free')) as plan, 
        COUNT(*) as count 
      FROM shops 
      GROUP BY LOWER(COALESCE(plan, 'free'))
    `);

    const planCounts = {
      free: 0,
      plus: 0,
      pro: 0,
      ultra_pro: 0
    };

    planRows.forEach(r => {
      const p = r.plan || 'free';
      if (p.includes('ultra')) planCounts.ultra_pro += Number(r.count);
      else if (p.includes('pro')) planCounts.pro += Number(r.count);
      else if (p.includes('plus')) planCounts.plus += Number(r.count);
      else planCounts.free += Number(r.count);
    });

    const activeSubscriptions = planCounts.plus + planCounts.pro + planCounts.ultra_pro;

    // Estimated Annualized / Monthly Revenue
    // Plus: ₹299/mo, Pro: ₹499/mo, Ultra: ₹4,999/yr
    const estimatedMonthlyRevenue = (planCounts.plus * 299) + (planCounts.pro * 499) + Math.round((planCounts.ultra_pro * 4999) / 12);
    const estimatedAnnualRevenue = (planCounts.plus * 299 * 12) + (planCounts.pro * 499 * 12) + (planCounts.ultra_pro * 4999);

    // Expiring within 7 days
    const nowIso = new Date().toISOString();
    const in7DaysIso = new Date(Date.now() + 7 * 86400000).toISOString();
    let expiringSoon = 0;
    try {
      const [expiringSoonRows] = await pool.query(
        'SELECT COUNT(*) as count FROM shops WHERE planExpiry IS NOT NULL AND planExpiry > ? AND planExpiry <= ?',
        [nowIso, in7DaysIso]
      );
      expiringSoon = expiringSoonRows[0]?.count || 0;
    } catch {}

    res.json({
      success: true,
      stats: {
        totalShops: Number(totalShops),
        totalUsers: Number(totalUsers),
        totalProducts: Number(totalProducts),
        totalTransactions: Number(totalTransactions),
        totalSalesVolume: Number(totalSalesVolume),
        planCounts,
        activeSubscriptions,
        estimatedMonthlyRevenue,
        estimatedAnnualRevenue,
        expiringSoon
      }
    });
  } catch (err) {
    console.error('Super Admin Stats Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. GET /api/superadmin/shops ──────────────────────────────────────────────
router.get('/shops', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.shopId,
        s.name as shopName,
        s.ownerName,
        s.phone,
        s.email,
        s.address,
        s.gstNumber,
        s.upiId,
        s.plan,
        s.planExpiry,
        s.createdAt,
        (SELECT COUNT(*) FROM products p WHERE p.shopId = s.shopId) as productCount,
        (SELECT COUNT(*) FROM users u WHERE u.shopId = s.shopId) as userCount,
        (SELECT COUNT(*) FROM transactions t WHERE t.shopId = s.shopId) as transactionCount,
        (SELECT COALESCE(SUM(totalAmount), 0) FROM transactions t WHERE t.shopId = s.shopId) as totalSalesVolume
      FROM shops s
      ORDER BY productCount DESC, totalSalesVolume DESC, s.createdAt DESC
    `;

    let [shops] = await pool.query(query).catch(e => {
      console.warn('Shops SQL query warning:', e.message);
      return [[]];
    });

    // Supabase fallback: if local DB has 0 shops or missed shops, fetch directly from Supabase
    if (!shops || shops.length === 0) {
      try {
        const { supabase } = require('../supabase');
        const { data: sbShops } = await supabase.from('shops').select('*').order('createdAt', { ascending: false });
        if (sbShops && sbShops.length > 0) {
          shops = sbShops.map(s => ({
            shopId: s.shopId,
            shopName: s.name,
            ownerName: s.ownerName,
            phone: s.phone,
            email: s.email,
            address: s.address,
            gstNumber: s.gstNumber,
            upiId: s.upiId,
            plan: s.plan,
            planExpiry: s.planExpiry,
            createdAt: s.createdAt,
            productCount: 0,
            userCount: 1,
            transactionCount: 0,
            totalSalesVolume: 0
          }));
        }
      } catch (sbErr) {
        console.warn('Super Admin Supabase direct fallback notice:', sbErr.message);
      }
    }

    // Format expiry and status
    const formattedShops = (shops || []).map(shop => {
      const now = new Date();
      const expiry = shop.planExpiry ? new Date(shop.planExpiry) : null;
      let status = 'free';

      const planName = (shop.plan || 'free').toLowerCase();
      const isPaid = planName === 'pro' || planName === 'ultra_pro' || planName === 'plus';

      if (isPaid) {
        if (!expiry) {
          status = 'lifetime';
        } else if (expiry > now) {
          const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          status = daysLeft <= 7 ? 'expiring_soon' : 'active';
        } else {
          status = 'expired';
        }
      }

      return {
        ...shop,
        productCount: Number(shop.productCount || 0),
        userCount: Number(shop.userCount || 0),
        transactionCount: Number(shop.transactionCount || 0),
        totalSalesVolume: Number(shop.totalSalesVolume || 0),
        subscriptionStatus: status
      };
    });

    res.json({ success: true, shops: formattedShops });
  } catch (err) {
    console.error('Super Admin Shops Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 3. PUT /api/superadmin/shops/:shopId/plan ──────────────────────────────────
router.put('/shops/:shopId/plan', async (req, res) => {
  const { shopId } = req.params;
  const { plan, durationDays, customExpiryDate } = req.body;

  try {
    let newExpiry = null;

    if (customExpiryDate) {
      newExpiry = new Date(customExpiryDate);
    } else if (durationDays && durationDays > 0) {
      newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + Number(durationDays));
    } else if (plan === 'free') {
      newExpiry = null;
    }

    const normalizedPlan = (plan || 'free').toLowerCase().includes('ultra') 
      ? 'ultra_pro' 
      : (plan || 'free').toLowerCase().includes('pro') 
      ? 'pro' 
      : (plan || 'free').toLowerCase().includes('plus')
      ? 'plus'
      : 'free';

    const expiryIso = newExpiry ? newExpiry.toISOString() : null;
    await pool.query(
      'UPDATE shops SET plan = ?, planExpiry = ? WHERE shopId = ?',
      [normalizedPlan, expiryIso, shopId]
    ).catch(() => {});

    // Sync to Supabase cloud
    try {
      const { supabase } = require('../supabase');
      await supabase.from('shops').update({ 
        plan: normalizedPlan, 
        planExpiry: newExpiry ? newExpiry.toISOString() : null 
      }).eq('shopId', shopId);
    } catch (sbSyncErr) {
      console.warn('Supabase plan update sync notice:', sbSyncErr.message);
    }

    // Auto-create in-app notification for the shopkeeper
    try {
      const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const expiryStr = newExpiry ? new Date(newExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Lifetime';
      const planBadge = normalizedPlan === 'ultra_pro' ? '👑 Ultra Pro' : normalizedPlan === 'pro' ? '⚡ Pro' : normalizedPlan === 'plus' ? '🌟 Plus' : 'Free';
      await pool.query(
        `INSERT INTO notifications (id, shopId, title, message, type, channel, actionUrl, isRead, readBy, createdAt)
         VALUES (?, ?, ?, ?, 'plan_upgrade', 'superadmin', '/upgrade', 0, '[]', ?)`,
        [
          notifId, 
          shopId, 
          `🎉 Subscription Upgraded: ${planBadge}!`,
          `Congratulations! Your store plan has been updated to *${planBadge}* by Super Admin. All premium features are now activated (Validity: ${expiryStr}).`,
          new Date().toISOString()
        ]
      ).catch(() => {});
    } catch (notifErr) {
      console.warn('Could not insert notification for plan update:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Shop ${shopId} plan updated to ${normalizedPlan}`,
      plan: normalizedPlan,
      planExpiry: newExpiry
    });
  } catch (err) {
    console.error('Super Admin Update Plan Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 4. DELETE /api/superadmin/shops/:shopId ────────────────────────────────────
router.delete('/shops/:shopId', async (req, res) => {
  const { shopId } = req.params;
  try {
    // Delete transactions, products, users, shop
    await pool.query('DELETE FROM transactions WHERE shopId = ?', [shopId]).catch(() => {});
    await pool.query('DELETE FROM products WHERE shopId = ?', [shopId]).catch(() => {});
    await pool.query('DELETE FROM users WHERE shopId = ?', [shopId]).catch(() => {});
    await pool.query('DELETE FROM shops WHERE shopId = ?', [shopId]).catch(() => {});

    try {
      const { supabase } = require('../supabase');
      await supabase.from('shops').delete().eq('shopId', shopId);
    } catch (e) {}

    res.json({ success: true, message: `Shop ${shopId} deleted successfully` });
  } catch (err) {
    console.error('Super Admin Delete Shop Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 5. POST /api/superadmin/impersonate/:shopId (1-Click Store Access) ──────────
router.post('/impersonate/:shopId', async (req, res) => {
  const { shopId } = req.params;
  try {
    // 1. Find shop in database
    let [shopRows] = await pool.query('SELECT * FROM shops WHERE shopId = ?', [shopId]).catch(() => [[]]);
    let targetShop = shopRows?.[0];

    if (!targetShop) {
      try {
        const { supabase } = require('../supabase');
        const { data: sbShop } = await supabase.from('shops').select('*').eq('shopId', shopId).single();
        if (sbShop) targetShop = sbShop;
      } catch (e) {}
    }

    if (!targetShop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // 2. Find admin user for this shop
    let [userRows] = await pool.query('SELECT * FROM users WHERE shopId = ? AND role = "admin" LIMIT 1', [shopId]).catch(() => [[]]);
    const targetUser = userRows?.[0] || {
      uid: 'admin_' + shopId,
      email: targetShop.email || `admin@${shopId}.com`,
      displayName: targetShop.ownerName || targetShop.name || 'Store Owner',
      role: 'admin',
      shopId: targetShop.shopId
    };

    // 3. Generate token
    const token = jwt.sign(
      { uid: targetUser.uid, shopId: targetShop.shopId, role: 'admin', isImpersonated: true },
      JWT_SECRET,
      { expiresIn: '3d' }
    );

    res.json({
      success: true,
      token,
      user: targetUser,
      shop: targetShop
    });
  } catch (err) {
    console.error('Super Admin Impersonate Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
