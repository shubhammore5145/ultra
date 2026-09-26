const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const whatsappBot = require('./whatsapp');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nayashi_kirana'
});

db.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
    return;
  }
  console.log('Connected to MySQL database!');
});

// Routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

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
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all route for React Router (must be after all API routes)
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  const indexPath = path.join(__dirname, '../dist/index.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('Backend API server is running on port ' + port);
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
