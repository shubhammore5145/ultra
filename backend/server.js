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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
const pool = require('./db');
pool.testConnection();

// Routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

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
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// --- WhatsApp Bot Routes ---
app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsappBot.getStatus());
});

app.post('/api/whatsapp/start', (req, res) => {
  whatsappBot.initializeWhatsApp();
  res.json({ success: true, message: 'WhatsApp initialization started' });
});

app.post('/api/whatsapp/logout', (req, res) => {
  whatsappBot.logout();
  res.json({ success: true, message: 'WhatsApp logged out' });
});

app.post('/api/whatsapp/send', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone and message are required' });
  }
  try {
    await whatsappBot.sendMessage(phone, message);
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('WhatsApp send error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

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
    res.status(200).send('KiranaPro Backend API running on port ' + port);
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
  console.log(`🚀 KiranaPro Server running on http://localhost:${port}`);

  // Auto-initialize WhatsApp bot
  setTimeout(() => {
    try {
      console.log('Auto-initializing WhatsApp bot (Baileys)...');
      whatsappBot.initializeWhatsApp();
    } catch (e) {
      console.error('Failed to auto-start WhatsApp bot:', e.message);
    }
  }, 2000);

  // Start keep-alive pinger (prevents Render from sleeping)
  setTimeout(() => startKeepAlive(), 5000);
});
