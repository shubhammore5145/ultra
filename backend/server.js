const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');
const whatsappBot = require('./whatsapp');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config(); // fallback to root .env if any

const app = express();
const port = process.env.PORT || 5000;

// Safety net: prevent errors from crashing the server
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception (server kept running):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection (server kept running):', reason?.message || reason);
});

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// In-Memory Rate Limiter for Auth Routes (Brute-force protection)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_AUTH_ATTEMPTS = 25; // 25 requests per minute per IP

function authRateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW;
  } else {
    record.count += 1;
  }

  rateLimitMap.set(ip, record);

  if (record.count > MAX_AUTH_ATTEMPTS) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: `Too many authentication attempts. Please try again in ${retryAfter} seconds.`,
      retryAfter
    });
  }
  next();
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Database Connection
const pool = require('./db');
pool.testConnection().catch(() => {});

// Routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const superAdminRoutes = require('./routes/superadmin');
const notificationsRoutes = require('./routes/notifications');

// ── Health Check Endpoint (for UptimeRobot / keep-alive pings) ────────────────
app.get('/api/ping', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + 's',
    whatsapp: whatsappBot.getStatus().status
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    db: require('./db').getStatus()
  });
});

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

function extractShopId(req) {
  if (req.query?.shopId && req.query.shopId !== 'undefined' && req.query.shopId !== 'null') {
    return String(req.query.shopId).trim();
  }
  if (req.body?.shopId && req.body.shopId !== 'undefined' && req.body.shopId !== 'null') {
    return String(req.body.shopId).trim();
  }
  if (req.headers['x-shop-id'] && req.headers['x-shop-id'] !== 'undefined' && req.headers['x-shop-id'] !== 'null') {
    return String(req.headers['x-shop-id']).trim();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.split(' ')[1];
    if (rawToken) {
      if (rawToken.startsWith('sb_')) {
        try {
          const jsonStr = Buffer.from(rawToken.slice(3), 'base64').toString('utf8');
          const payload = JSON.parse(jsonStr);
          if (payload?.shopId) return String(payload.shopId).trim();
        } catch (e) {}
      }
      try {
        const decoded = jwt.decode(rawToken);
        if (decoded?.shopId) return String(decoded.shopId).trim();
      } catch (e) {}
    }
  }
  return 'default';
}

// --- WhatsApp Bot Routes (Isolated per Shop) ---
app.get('/api/whatsapp/status', (req, res) => {
  const shopId = extractShopId(req);
  res.json(whatsappBot.getStatus(shopId));
});

app.post('/api/whatsapp/start', (req, res) => {
  const shopId = extractShopId(req);
  whatsappBot.initializeWhatsApp(shopId);
  res.json({ success: true, message: `WhatsApp initialization started for shop ${shopId}` });
});

app.post('/api/whatsapp/logout', async (req, res) => {
  const shopId = extractShopId(req);
  await whatsappBot.logout(shopId);
  res.json({ success: true, message: `WhatsApp logged out for shop ${shopId}` });
});

app.post('/api/whatsapp/send', async (req, res) => {
  const shopId = extractShopId(req);
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone and message are required' });
  }
  try {
    await whatsappBot.sendMessage(phone, message, shopId);
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error(`WhatsApp send error for shop ${shopId}:`, error.message);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Bulk WhatsApp Reminder for Udhar Customers
app.post('/api/whatsapp/bulk-reminder', async (req, res) => {
  const shopId = extractShopId(req);
  const { customers, shopName } = req.body;
  if (!customers || !Array.isArray(customers) || customers.length === 0) {
    return res.status(400).json({ error: 'Customers array is required' });
  }

  const botStatus = whatsappBot.getStatus(shopId);
  if (botStatus.status !== 'CONNECTED') {
    return res.status(400).json({ 
      error: 'Store WhatsApp Bot is not connected. Please scan the WhatsApp QR code in Settings.',
      notConnected: true 
    });
  }

  const results = {
    total: customers.length,
    sent: 0,
    failed: 0,
    details: []
  };

  const currentShopName = shopName || 'Our Store';

  for (const c of customers) {
    const rawBalance = Number(c.balance || 0);
    if (!c.phone || rawBalance <= 0) {
      results.failed++;
      results.details.push({ name: c.name, phone: c.phone, status: 'skipped', reason: 'No phone or zero balance' });
      continue;
    }

    const message = `🙏 *Hello ${c.name},*\n\nThis is a gentle reminder from *${currentShopName}*:\nYour outstanding balance is: *₹${rawBalance.toFixed(2)}*.\n\nPlease clear the balance at your earliest convenience. Feel free to contact us for any queries.\n\nThank you! 💐`;

    try {
      await whatsappBot.sendMessage(c.phone, message, shopId);
      results.sent++;
      results.details.push({ name: c.name, phone: c.phone, status: 'sent' });
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error(`WhatsApp bulk reminder error for shop ${shopId} ${c.name} (${c.phone}):`, err.message);
      results.failed++;
      results.details.push({ name: c.name, phone: c.phone, status: 'failed', error: err.message });
    }
  }

  res.json({ success: true, results });
});

app.post('/api/whatsapp/send-bill', async (req, res) => {
  const shopId = extractShopId(req);
  const { phone, message, billNo } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone and message are required' });
  }
  try {
    await whatsappBot.sendMessage(phone, message, shopId);
    res.json({ success: true, message: `WhatsApp bill #${billNo || ''} sent to +91 ${phone}` });
  } catch (error) {
    console.error(`WhatsApp send-bill error for shop ${shopId}:`, error.message);
    res.status(500).json({ error: error.message || 'Failed to send WhatsApp bill' });
  }
});

// Nightly Business WhatsApp Summary Generator & Sender
async function generateAndSendNightlySummary(shopId, targetPhone) {
  const pool = require('./db');
  const db = await pool.getDb();
  let shop = { name: 'MartGPT Store', phone: targetPhone };
  try {
    const found = await db.collection('shops').findOne({ shopId: shopId || 'default' });
    if (found) shop = found;
  } catch {}

  const recipientPhone = targetPhone || shop.phone;
  if (!recipientPhone) {
    throw new Error('Shop phone number is required to send nightly summary.');
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const startIso = todayStart.toISOString();
  const endIso = todayEnd.toISOString();
  const resolvedShopId = shop.shopId || shopId || 'default';

  let transactions = [];
  let expenses = [];
  let lowStock = [];

  try {
    transactions = await db.collection('transactions')
      .find({ shopId: resolvedShopId, isDeleted: { $ne: 1 }, createdAt: { $gte: startIso, $lte: endIso } })
      .toArray();
  } catch {}

  try {
    expenses = await db.collection('expenses')
      .find({ $or: [{ shopId: resolvedShopId }, { shopId: null }], date: { $gte: startIso.slice(0, 10), $lte: endIso.slice(0, 10) } })
      .toArray();
  } catch {}

  try {
    const prods = await db.collection('products')
      .find({ $or: [{ shopId: resolvedShopId }, { shopId: null }], isDeleted: { $ne: 1 } })
      .toArray();
    lowStock = prods.filter((p) => Number(p.stock || 0) <= Number(p.minStock || 0)).slice(0, 5);
  } catch {}

  let grossSales = 0;
  let cashSales = 0;
  let upiSales = 0;
  let udharSales = 0;
  const itemCounts = {};

  transactions.forEach(t => {
    const amt = Number(t.totalAmount) || 0;
    grossSales += amt;
    const method = (t.paymentMethod || '').toLowerCase();
    if (method === 'cash') cashSales += amt;
    else if (method === 'upi') upiSales += amt;
    else if (method === 'udhar') udharSales += amt;
    else if (method === 'split') {
      cashSales += amt / 2;
      upiSales += amt / 2;
    } else {
      cashSales += amt;
    }

    let items = [];
    try { items = typeof t.items === 'string' ? JSON.parse(t.items) : (t.items || []); } catch(e){}
    items.forEach(it => {
      if (it.name) {
        itemCounts[it.name] = (itemCounts[it.name] || 0) + (it.qty || 1);
      }
    });
  });

  let totalExpenses = 0;
  expenses.forEach(e => { totalExpenses += Number(e.amount) || 0; });

  const cashInHand = Math.max(0, cashSales - totalExpenses);

  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, qty]) => `• ${name}: ${qty} sold`)
    .join('\n');

  const lowStockAlert = lowStock.length > 0 
    ? lowStock.map(p => `• ⚠️ ${p.name}: ${p.stock} ${p.unit || ''} left`).join('\n')
    : '• All inventory healthy ✅';

  const dateFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const summaryMessage = 
`🌙 *DAILY BUSINESS SUMMARY REPORT* 🌙
🏪 *${shop.name || 'MartGPT Store'}*
📅 ${dateFormatted}
━━━━━━━━━━━━━━━━━━━

💰 *Gross Sales:* ₹${grossSales.toFixed(2)}
🧾 *Total Invoices:* ${transactions.length}

💳 *COLLECTIONS BREAKDOWN:*
💵 Cash Collected: ₹${cashSales.toFixed(2)}
📱 UPI Received: ₹${upiSales.toFixed(2)}
📝 Udhar Given: ₹${udharSales.toFixed(2)}

💸 *EXPENSES & CASH FLOW:*
📤 Today's Expenses: ₹${totalExpenses.toFixed(2)}
💼 Net Cash in Drawer: ₹${cashInHand.toFixed(2)}

⭐ *TOP SELLING PRODUCTS:*
${topItems || '• No items logged today'}

📦 *STOCK ALERTS:*
${lowStockAlert}

━━━━━━━━━━━━━━━━━━━
✨ *Generated automatically by MartGPT POS*`;

  await whatsappBot.sendMessage(recipientPhone, summaryMessage);
  return { success: true, message: 'Nightly summary sent to ' + recipientPhone, preview: summaryMessage };
}

// Nightly Business WhatsApp Summary Endpoint
app.post('/api/whatsapp/nightly-summary', async (req, res) => {
  const { shopId, targetPhone } = req.body;
  try {
    const result = await generateAndSendNightlySummary(shopId, targetPhone);
    res.json(result);
  } catch (error) {
    console.error('Nightly summary error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Nightly WhatsApp Summary Scheduler (Runs every 30s) ──────────────────────
const lastSummarySent = {}; // Key: `${shopId}_${YYYY-MM-DD}`

async function checkAndSendScheduledSummaries() {
  const status = whatsappBot.getStatus();
  if (status.status !== 'CONNECTED') return;

  // Indian Standard Time (IST = UTC + 5:30)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (3600000 * 5.5));

  const currentHHMM = istDate.toTimeString().slice(0, 5); // "HH:MM" e.g. "21:30"
  const dateKey = istDate.toISOString().slice(0, 10); // "YYYY-MM-DD"

  try {
    const pool = require('./db');
    const db = await pool.getDb();
    const shops = await db.collection('shops').find({}, { projection: { shopId: 1, name: 1, phone: 1, settings: 1 } }).toArray();

    for (const shop of shops) {
      let settings = {};
      try {
        settings = typeof shop.settings === 'string' ? JSON.parse(shop.settings) : (shop.settings || {});
      } catch {}

      const isEnabled = settings.whatsappSummaryEnabled !== false;
      const targetTime = settings.whatsappSummaryTime || '21:30';
      const recipientPhone = settings.whatsappSummaryPhone || shop.phone;
      const trackKey = `${shop.shopId}_${dateKey}`;

      if (isEnabled && recipientPhone && currentHHMM === targetTime && !lastSummarySent[trackKey]) {
        console.log(`[Auto-Summary] Triggering scheduled summary for ${shop.name} (${recipientPhone}) at ${currentHHMM}...`);
        lastSummarySent[trackKey] = true;
        try {
          await generateAndSendNightlySummary(shop.shopId, recipientPhone);
          console.log(`[Auto-Summary] Successfully sent scheduled summary to ${recipientPhone}`);
        } catch (err) {
          console.error(`[Auto-Summary] Failed to send to ${recipientPhone}:`, err.message);
          delete lastSummarySent[trackKey];
        }
      }
    }
  } catch {}
}

setInterval(checkAndSendScheduledSummaries, 30000);

app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', apiRoutes);

// Safe Global Error Handler for API
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack || err.message);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred. Please try again later.' 
      : err.message
  });
});

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all route for React Router
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  const indexPath = path.join(__dirname, '../dist/index.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('MartGPT Backend API running on port ' + port);
  }
});

// ── Keep-Alive Self-Ping (prevents Render free tier sleep) ────────────────────
function startKeepAlive() {
  // Only run on Render (not locally)
  const renderUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL;
  if (!renderUrl) {
    console.log('Keep-alive: Not on Render, skipping self-ping.');
    return;
  }

  const pingUrl = renderUrl.replace(/\/$/, '') + '/api/ping';
  console.log('Keep-alive: Will ping', pingUrl, 'every 10 minutes to prevent sleep.');

  // Ping every 10 minutes (600,000 ms)
  setInterval(() => {
    const mod = pingUrl.startsWith('https') ? https : http;
    const req = mod.get(pingUrl, (res) => {
      console.log('[Keep-alive] Pinged', pingUrl, '→ HTTP', res.statusCode);
    });
    req.on('error', (err) => {
      console.warn('[Keep-alive] Ping failed:', err.message);
    });
    req.end();
  }, 10 * 60 * 1000); // 10 minutes
}

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`🚀 MartGPT Server running on http://localhost:${port}`);

  // Auto-restore saved WhatsApp bot sessions for shops that have connected
  setTimeout(() => {
    try {
      console.log('Restoring saved WhatsApp sessions for connected shops...');
      if (typeof whatsappBot.restoreAllSavedSessions === 'function') {
        whatsappBot.restoreAllSavedSessions();
      }
    } catch (e) {
      console.error('Failed to auto-restore WhatsApp bot sessions:', e.message);
    }
  }, 2000);

  // Start keep-alive pinger (prevents Render from sleeping)
  setTimeout(() => startKeepAlive(), 5000);
});
