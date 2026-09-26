const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

let client = null;
let qrCodeDataUrl = null;
let clientStatus = 'DISCONNECTED';

function initializeWhatsApp() {
  if (client) {
    console.log('WhatsApp client already exists, status:', clientStatus);
    return;
  }

  clientStatus = 'INITIALIZING';
  qrCodeDataUrl = null;
  console.log('Initializing WhatsApp Web Client with Puppeteer...');
  
  // LocalAuth allows keeping the session after scanning QR once
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', async (qr) => {
    clientStatus = 'NEEDS_QR';
    try {
      qrCodeDataUrl = await qrcode.toDataURL(qr);
      console.log('WhatsApp QR Code generated successfully. Ready to scan.');
    } catch (err) {
      console.error('Failed to generate QR Code:', err);
    }
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`WhatsApp loading: ${percent}% - ${message}`);
  });

  client.on('ready', () => {
    console.log('WhatsApp Client is ready & connected!');
    clientStatus = 'CONNECTED';
    qrCodeDataUrl = null;
  });

  client.on('authenticated', () => {
    console.log('WhatsApp Authenticated!');
    clientStatus = 'AUTHENTICATED';
  });

  client.on('auth_failure', async (msg) => {
    console.error('WhatsApp Authentication failure:', msg);
    clientStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    try {
      if (client) await client.destroy();
    } catch (e) {}
    client = null;
  });

  client.on('disconnected', async (reason) => {
    console.log('WhatsApp Disconnected:', reason);
    clientStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    try {
      if (client) await client.destroy();
    } catch (e) {}
    client = null;
  });

  client.initialize().catch(async (err) => {
    console.error('WhatsApp initialization error:', err.message || err);
    clientStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    try {
      if (client) await client.destroy();
    } catch (e) {}
    client = null;
  });
}

function getStatus() {
  return {
    status: clientStatus,
    qr: qrCodeDataUrl
  };
}

async function sendMessage(phoneNumber, message) {
  if (!client || (clientStatus !== 'CONNECTED' && clientStatus !== 'AUTHENTICATED')) {
    throw new Error('WhatsApp is not connected. Current status: ' + clientStatus);
  }
  
  // Format phone number for WhatsApp: Country code without '+' + number + '@c.us'
  // Assuming Indian numbers (91)
  let formattedNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits
  if (formattedNumber.length === 10) {
    formattedNumber = '91' + formattedNumber;
  }
  
  const chatId = `${formattedNumber}@c.us`;
  
  try {
    await client.sendMessage(chatId, message);
    console.log(`WhatsApp message successfully sent to ${chatId}`);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

async function logout() {
  if (client) {
    try {
      await client.logout();
    } catch (err) {
      console.error('WhatsApp logout error (ignored):', err.message);
    }
    try {
      await client.destroy();
    } catch (e) {}
    client = null;
    clientStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    console.log('WhatsApp client successfully destroyed and logged out.');
  }
}

module.exports = {
  initializeWhatsApp,
  getStatus,
  sendMessage,
  logout
};
