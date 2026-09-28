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

// ─── State ────────────────────────────────────────────────────────────────────
let sock = null;
let qrCodeDataUrl = null;
let clientStatus = 'DISCONNECTED'; // DISCONNECTED | INITIALIZING | NEEDS_QR | PAIRING | CONNECTING | CONNECTED
let clientInfo = null;
let lastError = null;
let reconnectTimer = null;
let isConnecting = false;

const AUTH_DIR = path.join(__dirname, '.baileys_auth');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPhoneNumber(phone) {
  let clean = String(phone || '').replace(/\D/g, '');
  if (clean.length === 10) clean = '91' + clean;
  else if (clean.length === 11 && clean.startsWith('0')) clean = '91' + clean.slice(1);
  return clean;
}

// Check if credentials already exist
function hasSavedCredentials() {
  try {
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    return fs.existsSync(credsPath);
  } catch {
    return false;
  }
}

// ─── Core: connect ────────────────────────────────────────────────────────────
async function connect() {
  if (isConnecting) {
    console.log('[WhatsApp] Connection attempt already in progress, skipping duplicate.');
    return;
  }

  // Clear any pending reconnect
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  isConnecting = true;

  try {
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1015901307],
      isLatest: true
    }));

    if (clientStatus !== 'PAIRING') {
      clientStatus = hasSavedCredentials() ? 'CONNECTING' : 'INITIALIZING';
    }

    lastError = null;

    console.log(`[WhatsApp] Connecting via Baileys v${version.join('.')} (Latest: ${isLatest})...`);

    // Clean, silent pino logger to avoid terminal buffer dumps
    const silentLogger = pino({ level: 'silent' });

    // Cleanly terminate previous socket if any exists
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.ws?.close();
      } catch {}
      sock = null;
    }

    sock = makeWASocket({
      version,
      auth: state,
      logger: silentLogger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'), // Standard reliable browser identification
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 2000,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false
    });

    // Save credentials whenever updated (awaited to ensure disk persistence on Windows)
    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (err) {
        console.error('[WhatsApp] Error saving credentials:', err.message);
      }
    });

    // ── Connection events ──────────────────────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Handle QR code generation
      if (qr) {
        clientStatus = 'NEEDS_QR';
        try {
          qrCodeDataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 7 });
          console.log('[WhatsApp] Fresh QR code generated — ready to scan.');
        } catch (e) {
          console.error('[WhatsApp] QR generation error:', e.message);
        }
      }

      // Handle successful connection
      if (connection === 'open') {
        clientStatus = 'CONNECTED';
        qrCodeDataUrl = null;
        lastError = null;
        const me = sock?.user;
        if (me) {
          clientInfo = {
            phone: me.id?.split(':')[0] || me.id?.split('@')[0] || '',
            pushname: me.name || me.notify || 'Kirana Store'
          };
          console.log(`[WhatsApp] ✅ Connected successfully as: ${clientInfo.pushname} (+${clientInfo.phone})`);
        }
      }

      // Handle disconnection / reconnect
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : (lastDisconnect?.error?.code || null);

        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;

        console.log(`[WhatsApp] Connection closed. StatusCode: ${statusCode} | LoggedOut: ${isLoggedOut} | RestartRequired: ${isRestartRequired} | Replaced: ${isReplaced}`);

        const oldSock = sock;
        sock = null;
        if (oldSock) {
          try {
            oldSock.ev.removeAllListeners();
            oldSock.ws?.close();
          } catch {}
        }

        if (isLoggedOut) {
          // Explicit logout
          clientStatus = 'DISCONNECTED';
          clientInfo = null;
          qrCodeDataUrl = null;
          lastError = 'Session logged out. Please scan QR again.';
          try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
          console.log('[WhatsApp] Session wiped. Please scan QR again.');
        } else if (isReplaced) {
          // Replaced by another active session: do not spam reconnect
          clientStatus = 'DISCONNECTED';
          lastError = 'Connection replaced by another session.';
          console.log('[WhatsApp] Another session replaced this connection. Stopped reconnect loop.');
        } else if (isRestartRequired) {
          // KEY FIX FOR 1-TIME SCAN:
          // Baileys sends restartRequired (515) right after QR scan to reload new credentials.
          // Give 1200ms for Windows filesystem to flush creds.json completely before reconnecting.
          console.log('[WhatsApp] QR scanned & paired! Finalizing credentials and reconnecting...');
          clientStatus = 'PAIRING';
          qrCodeDataUrl = null;
          lastError = null;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(async () => {
            isConnecting = false;
            try {
              await connect();
            } catch (err) {
              console.error('[WhatsApp] Reconnect after pairing error:', err.message);
            }
          }, 1200);
        } else {
          // Temporary network drop or handshake retry
          clientStatus = 'CONNECTING';
          console.log('[WhatsApp] Reconnecting in 3s...');
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(async () => {
            isConnecting = false;
            try {
              await connect();
            } catch (err) {
              console.error('[WhatsApp] Reconnect error:', err.message);
            }
          }, 3000);
        }
      }
    });

  } catch (err) {
    console.error('[WhatsApp] Connection failure:', err.message);
    lastError = err.message || String(err);
    clientStatus = 'DISCONNECTED';
    sock = null;
  } finally {
    isConnecting = false;
  }
}

// Wait for socket to become ready (handles brief reconnects during sales)
async function waitForReady(timeoutMs = 12000) {
  if (clientStatus === 'CONNECTED' && sock) return true;
  
  // If disconnected and not reconnecting, try to reconnect
  if (clientStatus === 'DISCONNECTED' && !isConnecting && hasSavedCredentials()) {
    console.log('[WhatsApp] waitForReady: Auto-reconnecting...');
    connect().catch(() => {});
  }
  
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 300));
    if (clientStatus === 'CONNECTED' && sock) return true;
  }
  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────
function initializeWhatsApp() {
  if (clientStatus === 'CONNECTED' || clientStatus === 'PAIRING' || isConnecting) {
    console.log('[WhatsApp] Client already active or connecting. Status:', clientStatus);
    return;
  }
  connect().catch(err => {
    lastError = err.message || String(err);
    clientStatus = 'DISCONNECTED';
    console.error('[WhatsApp] Connect error:', lastError);
  });
}

function getStatus() {
  return {
    status: clientStatus,
    qr: qrCodeDataUrl,
    info: clientInfo,
    error: lastError,
    hasSavedSession: hasSavedCredentials()
  };
}

async function sendMessage(phoneNumber, message, maxRetries = 3) {
  // If socket is momentarily reconnecting, wait up to 12s
  const isReady = await waitForReady(12000);
  if (!isReady || !sock || clientStatus !== 'CONNECTED') {
    throw new Error(`WhatsApp bot is not connected. Current status: ${clientStatus}. Please connect in Settings.`);
  }

  const clean = formatPhoneNumber(phoneNumber);
  if (clean.length < 10) throw new Error('Invalid phone number: ' + phoneNumber);

  const jid = clean + '@s.whatsapp.net';

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      if (!sock || clientStatus !== 'CONNECTED') {
        // Socket died between retries, wait for reconnect
        const reconnected = await waitForReady(8000);
        if (!reconnected) throw new Error('Connection lost during send');
      }
      await sock.sendMessage(jid, { text: message });
      console.log(`[WhatsApp] Message successfully delivered to ${jid}`);
      return { success: true, jid };
    } catch (err) {
      attempt++;
      console.warn(`[WhatsApp] Send attempt ${attempt} failed for ${jid}: ${err.message}`);
      if (attempt > maxRetries) {
        throw new Error(`Failed to send WhatsApp message after ${maxRetries} retries: ${err.message}`);
      }
      // Exponential backoff: 1.5s, 3s, 4.5s
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
}

async function logout() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    try { await sock.logout(); } catch (e) {}
    sock = null;
  }
  clientStatus = 'DISCONNECTED';
  qrCodeDataUrl = null;
  clientInfo = null;
  lastError = null;
  isConnecting = false;
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
  console.log('[WhatsApp] Logged out and session cleared completely.');
}

// Bot is initialized by server.js on startup
module.exports = {
  initializeWhatsApp,
  getStatus,
  sendMessage,
  logout
};
