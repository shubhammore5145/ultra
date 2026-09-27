const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

let client = null;
let qrCodeDataUrl = null;
let clientStatus = 'DISCONNECTED';
let clientInfo = null;
let lastError = null;

function formatPhoneNumber(phone) {
  let clean = String(phone || '').replace(/\D/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  } else if (clean.length === 11 && clean.startsWith('0')) {
    clean = '91' + clean.slice(1);
  } else if (clean.length > 10 && clean.startsWith('91')) {
    // Already standard 91 format
  }
  return clean;
}

function initializeWhatsApp() {
  if (client) {
    console.log('WhatsApp client already initialized, current status:', clientStatus);
    return;
  }

  clientStatus = 'INITIALIZING';
  lastError = null;
  qrCodeDataUrl = null;
  clientInfo = null;
  console.log('Initializing WhatsApp Web Client with Puppeteer...');

  // Detect Linux Chromium paths if on Linux/Render
  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  if (!executablePath && process.platform === 'linux') {
    const fs = require('fs');
    const possiblePaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome'
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        executablePath = p;
        console.log('Found system Chromium at:', executablePath);
        break;
      }
    }
  }

  // LocalAuth persists the authenticated session in .wwebjs_auth
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    puppeteer: {
      headless: true,
      executablePath: executablePath,
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
    lastError = null;
    try {
      qrCodeDataUrl = await qrcode.toDataURL(qr);
      console.log('WhatsApp QR Code generated successfully. Ready to scan.');
    } catch (err) {
      console.error('Failed to generate QR Code data URL:', err);
    }
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`WhatsApp loading: ${percent}% - ${message}`);
  });

  client.on('ready', () => {
    console.log('WhatsApp Client is ready & connected!');
    clientStatus = 'CONNECTED';
    qrCodeDataUrl = null;
    lastError = null;
    try {
      if (client.info) {
        clientInfo = {
          wid: client.info.wid?._serialized || null,
          phone: client.info.wid?.user || null,
          pushname: client.info.pushname || null
        };
        console.log(`WhatsApp Bot connected as: +${clientInfo.phone} (${clientInfo.pushname || 'User'})`);
      }
    } catch (infoErr) {
      console.warn('Could not read client.info:', infoErr.message);
    }
  });

  client.on('authenticated', () => {
    console.log('WhatsApp Authenticated!');
    clientStatus = 'AUTHENTICATED';
    lastError = null;
  });

  client.on('auth_failure', async (msg) => {
    console.error('WhatsApp Authentication failure:', msg);
    lastError = 'Authentication failure: ' + msg;
    clientStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    clientInfo = null;
    try {
      if (client) await client.destroy();
    } catch (e) {}
    client = null;
  });

  client.on('disconnected', async (reason) => {
    console.log('WhatsApp Disconnected:', reason);
    lastError = 'Disconnected: ' + (reason || 'Session closed');
    clientStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    clientInfo = null;
    try {
      if (client) await client.destroy();
    } catch (e) {}
    client = null;
  });

  client.initialize().catch(async (err) => {
    lastError = err.message || String(err);
    console.error('WhatsApp initialization error:', lastError);
    clientStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    clientInfo = null;
    try {
      if (client) await client.destroy();
    } catch (e) {}
    client = null;
  });
}

function getStatus() {
  return {
    status: clientStatus,
    qr: qrCodeDataUrl,
    info: clientInfo,
    error: lastError
  };
}

async function sendMessage(phoneNumber, message) {
  if (!client || (clientStatus !== 'CONNECTED' && clientStatus !== 'AUTHENTICATED')) {
    throw new Error('WhatsApp bot is not connected. Current status: ' + clientStatus);
  }
  
  const cleanNumber = formatPhoneNumber(phoneNumber);
  if (cleanNumber.length < 10) {
    throw new Error('Invalid phone number format: ' + phoneNumber);
  }
  
  let targetChatId = `${cleanNumber}@c.us`;

  // Pre-validate number and resolve LID / serialized Wid
  try {
    const numberId = await client.getNumberId(cleanNumber);
    if (numberId && numberId._serialized) {
      targetChatId = numberId._serialized;
      console.log(`Resolved WhatsApp target: ${targetChatId}`);
    } else if (numberId === null) {
      console.warn(`Number +${cleanNumber} is not registered on WhatsApp`);
      throw new Error(`The phone number +${cleanNumber} is not registered on WhatsApp.`);
    }
  } catch (idErr) {
    if (idErr.message && idErr.message.includes('not registered on WhatsApp')) {
      throw idErr;
    }
    console.warn('getNumberId warning (attempting direct send):', idErr.message);
  }
  
  // Try sending with automatic recovery for detached frames and LID issues
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await client.sendMessage(targetChatId, message);
      console.log(`WhatsApp message successfully sent to ${targetChatId}`);
      return true;
    } catch (error) {
      console.error(`Attempt ${attempt} error sending WhatsApp message:`, error.message);
      
      const isLidError = error.message && error.message.includes('No LID for user');
      const isDetached = error.message && (
        error.message.includes('detached Frame') || 
        error.message.includes('Execution context was destroyed') ||
        error.message.includes('Target closed')
      );

      // If No LID, try opening/resolving the chat model first
      if (isLidError) {
        try {
          console.log(`Attempting chat lookup fallback for ${targetChatId}...`);
          const chat = await client.getChatById(targetChatId);
          if (chat) {
            await chat.sendMessage(message);
            console.log(`WhatsApp message successfully sent via chat object to ${targetChatId}`);
            return true;
          }
        } catch (chatErr) {
          console.error('Chat object fallback failed:', chatErr.message);
        }
      }

      if (isDetached && attempt < 3) {
        console.log(`Attempting to recover detached frame (attempt ${attempt})...`);
        try {
          if (client.pupBrowser) {
            const pages = await client.pupBrowser.pages();
            const activePage = pages.find(p => !p.isClosed() && (p.url().includes('whatsapp') || p.url().includes('web'))) || pages[0];
            if (activePage) {
              client.pupPage = activePage;
              if (attempt === 2) {
                console.log('Reloading WhatsApp Web page to reset frame...');
                await client.pupPage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
              }
              await client.inject();
              console.log('Re-injected client scripts into active frame. Retrying...');
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
          }
        } catch (recoverErr) {
          console.error('Frame recovery attempt failed:', recoverErr.message);
        }
      }

      if (attempt === 3 || (!isDetached && !isLidError)) {
        throw error;
      }
    }
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
    clientInfo = null;
    console.log('WhatsApp client successfully destroyed and logged out.');
  }
}

module.exports = {
  initializeWhatsApp,
  getStatus,
  sendMessage,
  logout,
  formatPhoneNumber
};
