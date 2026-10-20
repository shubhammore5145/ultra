import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pool = require('../backend/db.js');
const authRoutes = require('../backend/routes/auth.js');
const apiRoutes = require('../backend/routes/api.js');
const superAdminRoutes = require('../backend/routes/superadmin.js');
const notificationsRoutes = require('../backend/routes/notifications.js');

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

pool.testConnection().catch(e => console.warn('Vercel DB init notice:', e.message));

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', apiRoutes);

app.use('/auth', authRoutes);
app.use('/superadmin', superAdminRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/', apiRoutes);

app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    status: 'cloud_ready',
    platform: 'vercel',
    message: 'WhatsApp automated billing active.'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'vercel-serverless',
    timestamp: new Date().toISOString(),
    db: pool.getStatus()
  });
});

export default app;
