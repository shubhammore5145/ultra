const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');

// ─── State ────────────────────────────────────────────────────────────────────
let sock = null;
let qrCodeDataUrl = null;
let clientStatus = 'DISCONNECTED'; // DISCONNECTED | INITIALIZING | NEEDS_QR | CONNECTED
let clientInfo = null;
let lastError = null;
let reconnectTimer = null;

const AUTH_DIR = path.join(__dirname, '.baileys_auth');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPhoneNumber(phone) {
  let clean = String(phone || '').replace(/\D/g, '');
  if (clean.length === 10) clean = '91' + clean;
  else if (clean.length === 11 && clean.startsWith('0')) clean = '91' + clean.slice(1);
  return clean;
}

// ─── Core: connect ────────────────────────────────────────────────────────────
async function connect() {
  // Clear any pending reconnect
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  clientStatus = 'INITIALIZING';
  lastError = null;
  qrCodeDataUrl = null;
  clientInfo = null;

  console.log('Connecting to WhatsApp via Baileys v' + version.join('.'));

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,  // We handle QR ourselves
    browser: ['KiranaPro', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 2000,
  });

  // Save credentials whenever updated
  sock.ev.on('creds.update', saveCreds);

  // ── Connection events ──────────────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      clientStatus = 'NEEDS_QR';
      try {
        qrCodeDataUrl = await qrcode.toDataURL(qr);
        console.log('WhatsApp QR generated — scan in app.');
      } catch (e) {
        console.error('QR generation error:', e.message);
      }
    }

    if (connection === 'open') {
      clientStatus = 'CONNECTED';
      qrCodeDataUrl = null;
      lastError = null;
      const me = sock.user;
      clientInfo = {
        phone: me?.id?.split(':')[0] || me?.id?.split('@')[0],
        pushname: me?.name || me?.notify || 'Unknown'
      };
      console.log('WhatsApp Connected as:', clientInfo.pushname, '+' + clientInfo.phone);
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : null;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log('WhatsApp disconnected. StatusCode:', statusCode, '| Reconnect:', shouldReconnect);
      clientStatus = 'DISCONNECTED';
      clientInfo = null;
      qrCodeDataUrl = null;
      sock = null;

      if (shouldReconnect) {
        lastError = null;
        console.log('Auto-reconnecting in 5s...');
        reconnectTimer = setTimeout(() => connect(), 5000);
      } else {
        // Logged out: clear saved session
        lastError = 'Session logged out. Please scan QR again.';
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
        console.log('Session cleared. Start bot again to scan QR.');
      }
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────
function initializeWhatsApp() {
  if (clientStatus === 'CONNECTED' || clientStatus === 'INITIALIZING') {
    console.log('WhatsApp already running. Status:', clientStatus);
    return;
  }
  connect().catch(err => {
    lastError = err.message || String(err);
    clientStatus = 'DISCONNECTED';
    console.error('WhatsApp connect error:', lastError);
  });
}

function getStatus() {
  return { status: clientStatus, qr: qrCodeDataUrl, info: clientInfo, error: lastError };
}

async function sendMessage(phoneNumber, message) {
  if (!sock || clientStatus !== 'CONNECTED') {
    throw new Error('WhatsApp bot is not connected. Status: ' + clientStatus);
  }
  const clean = formatPhoneNumber(phoneNumber);
  if (clean.length < 10) throw new Error('Invalid phone number: ' + phoneNumber);

  const jid = clean + '@s.whatsapp.net';
  try {
    await sock.sendMessage(jid, { text: message });
    console.log('WhatsApp message sent to', jid);
  } catch (err) {
    // Try without country code as fallback (already has 91)
    throw new Error('Failed to send: ' + err.message);
  }
}

async function logout() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (sock) {
    try { await sock.logout(); } catch (e) {}
    sock = null;
  }
  clientStatus = 'DISCONNECTED';
  qrCodeDataUrl = null;
  clientInfo = null;
  lastError = null;
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
  console.log('WhatsApp logged out and session cleared.');
}

module.exports = { initializeWhatsApp, getStatus, sendMessage, logout };
