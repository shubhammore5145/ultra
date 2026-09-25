const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let client = null;
let qrCodeDataUrl = null;
let clientStatus = 'DISCONNECTED';

function initializeWhatsApp() {
  if (client) return;

  clientStatus = 'INITIALIZING';
  
  // LocalAuth allows keeping the session after scanning QR once
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
    }
  });

  client.on('qr', async (qr) => {
    clientStatus = 'NEEDS_QR';
    try {
      qrCodeDataUrl = await qrcode.toDataURL(qr);
      console.log('WhatsApp QR Code generated.');
    } catch (err) {
      console.error('Failed to generate QR Code:', err);
    }
  });

  client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    clientStatus = 'CONNECTED';
    qrCodeDataUrl = null;
  });

  client.on('authenticated', () => {
    console.log('WhatsApp Authenticated!');
    clientStatus = 'AUTHENTICATED';
  });

  client.on('auth_failure', msg => {
    console.error('WhatsApp Authentication failure', msg);
    clientStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
  });

  client.on('disconnected', (reason) => {
    console.log('WhatsApp Disconnected', reason);
    clientStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    client = null;
    
    // Automatically reinitialize on disconnect
    setTimeout(() => {
      initializeWhatsApp();
    }, 5000);
  });

  client.initialize().catch(err => {
    console.error('WhatsApp initialization error:', err);
    clientStatus = 'ERROR';
  });
}

function getStatus() {
  return {
    status: clientStatus,
    qr: qrCodeDataUrl
  };
}

async function sendMessage(phoneNumber, message) {
  if (!client || clientStatus !== 'CONNECTED') {
    throw new Error('WhatsApp is not connected.');
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
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

function logout() {
  if (client) {
    client.logout();
  }
}

module.exports = {
  initializeWhatsApp,
  getStatus,
  sendMessage,
  logout
};
