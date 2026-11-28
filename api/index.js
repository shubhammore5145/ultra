import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pool = require('../backend/db.js');
const { requireAuth } = require('../backend/middleware/auth.js');
const authRoutes = require('../backend/routes/auth.js');
const apiRoutes = require('../backend/routes/api.js');
const superAdminRoutes = require('../backend/routes/superadmin.js');
const notificationsRoutes = require('../backend/routes/notifications.js');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Ensure MongoDB Atlas pool is connected before handling API requests on serverless cold starts
app.use(async (req, res, next) => {
  try {
    await pool.ensureConnected();
    next();
  } catch (e) {
    console.warn('Vercel MongoDB init notice:', e.message);
    next();
  }
});

app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', platform: 'vercel-serverless', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'vercel-serverless',
    timestamp: new Date().toISOString(),
    db: pool.getStatus()
  });
});

app.get('/api/whatsapp/status', requireAuth, (req, res) => {
  res.json({
    status: 'cloud_ready',
    platform: 'vercel',
    message: 'WhatsApp automated billing active.'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', apiRoutes);

app.use('/auth', authRoutes);
app.use('/superadmin', superAdminRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/', apiRoutes);

export default app;
