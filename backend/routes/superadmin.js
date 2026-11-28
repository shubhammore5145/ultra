const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET, getMasterKey, isSuperAdminUser } = require('../middleware/auth');

const superAdminMiddleware = async (req, res, next) => {
  try {
    const rawKey = req.headers['x-superadmin-key'] || req.headers['x-master-key'] || req.query.key;
    if (rawKey && String(rawKey).trim() === getMasterKey()) {
      req.isSuperAdmin = true;
      return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = await pool.getDb();
        const user = await db.collection('users').findOne(
          { uid: decoded.uid },
          { projection: { _id: 0, uid: 1, email: 1, displayName: 1, role: 1 } }
        );
        const target = user || decoded;

        if (isSuperAdminUser(target)) {
          req.user = target;
          req.isSuperAdmin = true;
          return next();
        }
      } catch {}
    }

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
    const db = await pool.getDb();

    const [totalShops, totalUsers, totalProducts, txAgg, shopPlans] = await Promise.all([
      db.collection('shops').countDocuments(),
      db.collection('users').countDocuments(),
      db.collection('products').countDocuments({ isDeleted: { $ne: 1 } }),
      db.collection('transactions').aggregate([
        { $match: { isDeleted: { $ne: 1 } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalSales: { $sum: { $convert: { input: '$totalAmount', to: 'double', onError: 0, onNull: 0 } } }
          }
        }
      ]).toArray(),
      db.collection('shops').find({}, { projection: { _id: 0, plan: 1, planExpiry: 1 } }).toArray()
    ]);

    const totalTransactions = Number(txAgg[0]?.count || 0);
    const totalSalesVolume = Number(txAgg[0]?.totalSales || 0);

    const planCounts = { free: 0, plus: 0, pro: 0, ultra_pro: 0 };
    const now = Date.now();
    const in7Days = now + 7 * 86400000;
    let expiringSoon = 0;

    for (const s of shopPlans) {
      const p = String(s.plan || 'free').toLowerCase();
      if (p.includes('ultra')) planCounts.ultra_pro++;
      else if (p.includes('pro')) planCounts.pro++;
      else if (p.includes('plus')) planCounts.plus++;
      else planCounts.free++;

      if (s.planExpiry) {
        const expMs = new Date(s.planExpiry).getTime();
        if (!isNaN(expMs) && expMs > now && expMs <= in7Days) {
          expiringSoon++;
        }
      }
    }

    const activeSubscriptions = planCounts.plus + planCounts.pro + planCounts.ultra_pro;
    const estimatedMonthlyRevenue =
      (planCounts.plus * 299) + (planCounts.pro * 499) + Math.round((planCounts.ultra_pro * 4999) / 12);
    const estimatedAnnualRevenue =
      (planCounts.plus * 299 * 12) + (planCounts.pro * 499 * 12) + (planCounts.ultra_pro * 4999);

    res.json({
      success: true,
      stats: {
        totalShops,
        totalUsers,
        totalProducts,
        totalTransactions,
        totalSalesVolume,
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
    const db = await pool.getDb();

    const [shops, prodCounts, userCounts, txCounts] = await Promise.all([
      db.collection('shops').find({}, { projection: { _id: 0 } }).toArray(),
      db.collection('products').aggregate([
        { $match: { isDeleted: { $ne: 1 } } },
        { $group: { _id: '$shopId', count: { $sum: 1 } } }
      ]).toArray(),
      db.collection('users').aggregate([
        { $group: { _id: '$shopId', count: { $sum: 1 } } }
      ]).toArray(),
      db.collection('transactions').aggregate([
        { $match: { isDeleted: { $ne: 1 } } },
        {
          $group: {
            _id: '$shopId',
            count: { $sum: 1 },
            volume: { $sum: { $convert: { input: '$totalAmount', to: 'double', onError: 0, onNull: 0 } } }
          }
        }
      ]).toArray()
    ]);

    const prodMap = new Map(prodCounts.map((r) => [r._id, Number(r.count || 0)]));
    const userMap = new Map(userCounts.map((r) => [r._id, Number(r.count || 0)]));
    const txMap = new Map(txCounts.map((r) => [r._id, { count: Number(r.count || 0), volume: Number(r.volume || 0) }]));

    const now = new Date();
    const formattedShops = shops.map((s) => {
      const txStats = txMap.get(s.shopId) || { count: 0, volume: 0 };
      const productCount = prodMap.get(s.shopId) || 0;
      const userCount = userMap.get(s.shopId) || 0;

      const expiry = s.planExpiry ? new Date(s.planExpiry) : null;
      let status = 'free';
      const planName = (s.plan || 'free').toLowerCase();
      const isPaid = planName === 'pro' || planName === 'ultra_pro' || planName === 'plus';

      if (isPaid) {
        if (!expiry || isNaN(expiry.getTime())) {
          status = 'lifetime';
        } else if (expiry > now) {
          const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          status = daysLeft <= 7 ? 'expiring_soon' : 'active';
        } else {
          status = 'expired';
        }
      }

      return {
        shopId: s.shopId,
        shopName: s.name || s.shopName,
        ownerName: s.ownerName,
        phone: s.phone,
        email: s.email,
        address: s.address,
        gstNumber: s.gstNumber,
        upiId: s.upiId,
        plan: s.plan || 'free',
        planExpiry: s.planExpiry || null,
        createdAt: s.createdAt,
        productCount,
        userCount,
        transactionCount: txStats.count,
        totalSalesVolume: txStats.volume,
        subscriptionStatus: status
      };
    });

    formattedShops.sort((a, b) => {
      if (b.productCount !== a.productCount) return b.productCount - a.productCount;
      if (b.totalSalesVolume !== a.totalSalesVolume) return b.totalSalesVolume - a.totalSalesVolume;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
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
    const db = await pool.getDb();
    let newExpiry = null;

    if (customExpiryDate) {
      newExpiry = new Date(customExpiryDate);
    } else if (durationDays && durationDays > 0) {
      newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + Number(durationDays));
    } else if (plan === 'free') {
      newExpiry = null;
    }

    const rawPlan = (plan || 'free').toLowerCase();
    const normalizedPlan = rawPlan.includes('ultra')
      ? 'ultra_pro'
      : rawPlan.includes('pro')
      ? 'pro'
      : rawPlan.includes('plus')
      ? 'plus'
      : 'free';

    const expiryIso = newExpiry ? newExpiry.toISOString() : null;
    await db.collection('shops').updateOne(
      { shopId },
      { $set: { plan: normalizedPlan, planExpiry: expiryIso } }
    );

    try {
      const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      const expiryStr = newExpiry
        ? new Date(newExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Lifetime';
      const planBadge =
        normalizedPlan === 'ultra_pro'
          ? '👑 Ultra Pro'
          : normalizedPlan === 'pro'
          ? '⚡ Pro'
          : normalizedPlan === 'plus'
          ? '🌟 Plus'
          : 'Free';

      await db.collection('notifications').insertOne({
        id: notifId,
        shopId,
        title: `🎉 Subscription Upgraded: ${planBadge}!`,
        message: `Congratulations! Your store plan has been updated to *${planBadge}* by Super Admin. All premium features are now activated (Validity: ${expiryStr}).`,
        type: 'plan_upgrade',
        channel: 'superadmin',
        actionUrl: '/upgrade',
        isRead: 0,
        readBy: [],
        createdAt: new Date().toISOString()
      });
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
    const db = await pool.getDb();
    await Promise.all([
      db.collection('transactions').deleteMany({ shopId }),
      db.collection('products').deleteMany({ shopId }),
      db.collection('users').deleteMany({ shopId }),
      db.collection('customers').deleteMany({ shopId }),
      db.collection('expenses').deleteMany({ shopId }),
      db.collection('udhar_transactions').deleteMany({ shopId }),
      db.collection('suppliers').deleteMany({ shopId }),
      db.collection('purchases').deleteMany({ shopId }),
      db.collection('staff').deleteMany({ shopId }),
      db.collection('staff_attendance').deleteMany({ shopId }),
      db.collection('staff_salary_payments').deleteMany({ shopId }),
      db.collection('sales_returns').deleteMany({ shopId }),
      db.collection('notifications').deleteMany({ shopId }),
      db.collection('damaged_goods').deleteMany({ shopId }),
      db.collection('stock_movements').deleteMany({ shopId }),
      db.collection('cash_counter_closings').deleteMany({ shopId }),
      db.collection('shops').deleteOne({ shopId })
    ]);

    res.json({ success: true, message: `Shop ${shopId} deleted successfully` });
  } catch (err) {
    console.error('Super Admin Delete Shop Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 5. POST /api/superadmin/impersonate/:shopId ────────────────────────────────
router.post('/impersonate/:shopId', async (req, res) => {
  const { shopId } = req.params;
  try {
    const db = await pool.getDb();
    const targetShop = pool.stripMongoId(await db.collection('shops').findOne({ shopId }));
    if (!targetShop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    let targetUser = pool.stripMongoId(
      await db.collection('users').findOne(
        { shopId, role: 'admin' },
        { projection: { _id: 0, password: 0 } }
      )
    );

    if (!targetUser) {
      targetUser = {
        uid: 'admin_' + shopId,
        email: targetShop.email || `admin@${shopId}.com`,
        displayName: targetShop.ownerName || targetShop.name || 'Store Owner',
        role: 'admin',
        shopId: targetShop.shopId
      };
    }

    const token = jwt.sign(
      { uid: targetUser.uid, shopId: targetShop.shopId, role: 'admin', isImpersonated: true },
      JWT_SECRET,
      { expiresIn: '3d' }
    );

    res.json({ success: true, token, user: targetUser, shop: targetShop });
  } catch (err) {
    console.error('Super Admin Impersonate Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
