const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');

// ─── Multi-Tenant Session Store (One WhatsApp per Shop) ─────────────────────
const sessions = new Map();

function getAuthDir(shopId = 'default') {
  const cleanId = String(shopId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseDir = path.join(__dirname, '.baileys_auth');
  const shopDir = path.join(baseDir, cleanId);
  if (!fs.existsSync(shopDir)) {
    fs.mkdirSync(shopDir, { recursive: true });
  }
  return shopDir;
}

function hasSavedCredentials(shopId = 'default') {
  try {
    const credsPath = path.join(getAuthDir(shopId), 'creds.json');
    return fs.existsSync(credsPath);
  } catch {
    return false;
  }
}

function getSessionState(shopId = 'default') {
  const cleanId = String(shopId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!sessions.has(cleanId)) {
    sessions.set(cleanId, {
      shopId: cleanId,
      sock: null,
      qrCodeDataUrl: null,
      clientStatus: hasSavedCredentials(cleanId) ? 'CONNECTING' : 'DISCONNECTED',
      clientInfo: null,
      lastError: null,
      reconnectTimer: null,
      isConnecting: false,
      authDir: getAuthDir(cleanId)
    });
  }
  return sessions.get(cleanId);
}

// Format 10-digit Indian phone number
function formatPhoneNumber(phone) {
  let clean = String(phone || '').replace(/\D/g, '');
  if (clean.length === 10) clean = '91' + clean;
  else if (clean.length === 11 && clean.startsWith('0')) clean = '91' + clean.slice(1);
  return clean;
}

// ─── Core: connectPerShop ───────────────────────────────────────────────────
async function connectShop(shopId = 'default') {
  const session = getSessionState(shopId);

  if (session.isConnecting) {
    console.log(`[WhatsApp - Shop ${shopId}] Connection attempt in progress, skipping duplicate.`);
    return;
  }

  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }

  session.isConnecting = true;

  try {
    const authDir = getAuthDir(shopId);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1015901307],
      isLatest: true
    }));

    if (session.clientStatus !== 'PAIRING') {
      session.clientStatus = hasSavedCredentials(shopId) ? 'CONNECTING' : 'INITIALIZING';
    }
    session.lastError = null;

    console.log(`[WhatsApp - Shop ${shopId}] Connecting via Baileys v${version.join('.')}...`);

    const silentLogger = pino({ level: 'silent' });

    if (session.sock) {
      try {
        session.sock.ev.removeAllListeners();
        session.sock.ws?.close();
      } catch {}
      session.sock = null;
    }

    const sock = makeWASocket({
      version,
      auth: state,
      logger: silentLogger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu(`MartGPT-${shopId}`),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 2000,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false
    });

    session.sock = sock;

    // Save credentials when updated
    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (err) {
        console.error(`[WhatsApp - Shop ${shopId}] Error saving credentials:`, err.message);
      }
    });

    // Handle connection events
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR Code update
      if (qr) {
        session.clientStatus = 'NEEDS_QR';
        try {
          session.qrCodeDataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 7 });
          console.log(`[WhatsApp - Shop ${shopId}] QR code generated — ready in Settings.`);
        } catch (e) {
          console.error(`[WhatsApp - Shop ${shopId}] QR generation error:`, e.message);
        }
      }

      // Connection Open (Success)
      if (connection === 'open') {
        session.clientStatus = 'CONNECTED';
        session.qrCodeDataUrl = null;
        session.lastError = null;
        const me = sock?.user;
        if (me) {
          session.clientInfo = {
            phone: me.id?.split(':')[0] || me.id?.split('@')[0] || '',
            pushname: me.name || me.notify || `Shop ${shopId}`
          };
          console.log(`[WhatsApp - Shop ${shopId}] ✅ Connected as: ${session.clientInfo.pushname} (+${session.clientInfo.phone})`);
        }
      }

      // Connection Closed / Reconnect
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : (lastDisconnect?.error?.code || null);

        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;

        console.log(`[WhatsApp - Shop ${shopId}] Connection closed. StatusCode: ${statusCode} | LoggedOut: ${isLoggedOut} | Restart: ${isRestartRequired}`);

        const oldSock = session.sock;
        session.sock = null;
        if (oldSock) {
          try {
            oldSock.ev.removeAllListeners();
            oldSock.ws?.close();
          } catch {}
        }

        if (isLoggedOut) {
          session.clientStatus = 'DISCONNECTED';
          session.clientInfo = null;
          session.qrCodeDataUrl = null;
          session.lastError = 'Session logged out. Please scan QR again.';
          try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
          console.log(`[WhatsApp - Shop ${shopId}] Session cleared.`);
        } else if (isReplaced) {
          session.clientStatus = 'DISCONNECTED';
          session.lastError = 'Connection replaced by another session.';
        } else if (isRestartRequired) {
          console.log(`[WhatsApp - Shop ${shopId}] QR scanned & paired! Finalizing credentials...`);
          session.clientStatus = 'PAIRING';
          session.qrCodeDataUrl = null;
          session.lastError = null;
          if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
          session.reconnectTimer = setTimeout(async () => {
            session.isConnecting = false;
            try { await connectShop(shopId); } catch (e) {}
          }, 1200);
        } else {
          session.clientStatus = 'CONNECTING';
          if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
          session.reconnectTimer = setTimeout(async () => {
            session.isConnecting = false;
            try { await connectShop(shopId); } catch (e) {}
          }, 3000);
        }
      }
    });

  } catch (err) {
    console.error(`[WhatsApp - Shop ${shopId}] Connection failure:`, err.message);
    session.lastError = err.message || String(err);
    session.clientStatus = 'DISCONNECTED';
    session.sock = null;
  } finally {
    session.isConnecting = false;
  }
}

// Wait for socket to become ready
async function waitForReady(shopId = 'default', timeoutMs = 12000) {
  const session = getSessionState(shopId);
  if (session.clientStatus === 'CONNECTED' && session.sock) return true;

  if (session.clientStatus === 'DISCONNECTED' && !session.isConnecting && hasSavedCredentials(shopId)) {
    connectShop(shopId).catch(() => {});
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 300));
    if (session.clientStatus === 'CONNECTED' && session.sock) return true;
  }
  return false;
}

// ─── Public Multi-Tenant APIs ────────────────────────────────────────────────
function initializeWhatsApp(shopId = 'default') {
  const session = getSessionState(shopId);
  if (session.clientStatus === 'CONNECTED' || session.clientStatus === 'PAIRING' || session.isConnecting) {
    return;
  }
  connectShop(shopId).catch(err => {
    session.lastError = err.message || String(err);
    session.clientStatus = 'DISCONNECTED';
  });
}

function getStatus(shopId = 'default') {
  const session = getSessionState(shopId);
  return {
    shopId,
    status: session.clientStatus,
    qr: session.qrCodeDataUrl,
    info: session.clientInfo,
    error: session.lastError,
    hasSavedSession: hasSavedCredentials(shopId)
  };
}

async function sendViaGreenApi(phoneNumber, message, greenConfig = {}) {
  const idInstance = greenConfig.idInstance || process.env.GREEN_API_ID_INSTANCE;
  const apiTokenInstance = greenConfig.apiTokenInstance || process.env.GREEN_API_TOKEN_INSTANCE;
  const apiUrl = (greenConfig.apiUrl || process.env.GREEN_API_URL || 'https://api.green-api.com').replace(/\/+$/, '');

  if (!idInstance || !apiTokenInstance) {
    return null;
  }

  const clean = formatPhoneNumber(phoneNumber);
  const chatId = `${clean}@c.us`;
  const url = `${apiUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Green API HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  console.log(`[Green API] Message delivered to ${chatId} (ID: ${data.idMessage})`);
  return { success: true, idMessage: data.idMessage };
}

async function sendMessage(phoneNumber, message, shopId = 'default', maxRetries = 3, greenConfig = null) {
  // If Green API credentials provided, try sending via Green API first
  if (greenConfig || process.env.GREEN_API_ID_INSTANCE) {
    try {
      const gaResult = await sendViaGreenApi(phoneNumber, message, greenConfig || {});
      if (gaResult) return gaResult;
    } catch (gaErr) {
      console.warn(`[WhatsApp - Shop ${shopId}] Green API dispatch failed:`, gaErr.message);
    }
  }

  const session = getSessionState(shopId);

  // If shop does not have saved credentials or is not connected
  if (!hasSavedCredentials(shopId) && session.clientStatus !== 'CONNECTED') {
    throw new Error(`WhatsApp is not linked for shop (${shopId}). Please link WhatsApp in Settings -> WhatsApp.`);
  }

  const isReady = await waitForReady(shopId, 12000);
  if (!isReady || !session.sock || session.clientStatus !== 'CONNECTED') {
    throw new Error(`WhatsApp bot (${shopId}) is not connected (Status: ${session.clientStatus}). Please reconnect in Settings.`);
  }

  const clean = formatPhoneNumber(phoneNumber);
  if (clean.length < 10) throw new Error('Invalid phone number: ' + phoneNumber);
  const jid = clean + '@s.whatsapp.net';

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      if (!session.sock || session.clientStatus !== 'CONNECTED') {
        const reconnected = await waitForReady(shopId, 8000);
        if (!reconnected) throw new Error('Connection lost during send');
      }
      await session.sock.sendMessage(jid, { text: message });
      console.log(`[WhatsApp - Shop ${shopId}] Message delivered to ${jid}`);
      return { success: true, jid };
    } catch (err) {
      attempt++;
      console.warn(`[WhatsApp - Shop ${shopId}] Send attempt ${attempt} failed for ${jid}: ${err.message}`);
      if (attempt > maxRetries) {
        throw new Error(`Failed to send WhatsApp message after ${maxRetries} retries: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
}

async function logout(shopId = 'default') {
  const session = getSessionState(shopId);
  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }
  if (session.sock) {
    try { await session.sock.logout(); } catch (e) {}
    session.sock = null;
  }
  session.clientStatus = 'DISCONNECTED';
  session.qrCodeDataUrl = null;
  session.clientInfo = null;
  session.lastError = null;
  session.isConnecting = false;
  try {
    fs.rmSync(session.authDir, { recursive: true, force: true });
  } catch (e) {}
  console.log(`[WhatsApp - Shop ${shopId}] Logged out and session cleared.`);
}

function restoreAllSavedSessions() {
  try {
    const baseDir = path.join(__dirname, '.baileys_auth');
    if (!fs.existsSync(baseDir)) return;
    const items = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const shopId = item.name;
        if (hasSavedCredentials(shopId)) {
          console.log(`[WhatsApp] Auto-restoring saved session for shop: ${shopId}`);
          initializeWhatsApp(shopId);
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Error restoring saved sessions:', err.message);
  }
}

module.exports = {
  initializeWhatsApp,
  getStatus,
  sendMessage,
  sendViaGreenApi,
  logout,
  restoreAllSavedSessions
};

