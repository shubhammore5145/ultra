const https = require('https');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  'shopastra-6c0c3';

const SUPERADMIN_IDENTIFIERS = [
  'shubham45mgm@gmail.com',
  'shubhamnmore16@gmail.com',
  'shubhamvmore12@gmail.com'
];

if (!process.env.JWT_SECRET) {
  console.warn('[Security] JWT_SECRET env var is not set; using fallback key. Set JWT_SECRET in production.');
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts = null;
let certsExpiresAt = 0;

function fetchGoogleCerts() {
  if (cachedCerts && Date.now() < certsExpiresAt) {
    return Promise.resolve(cachedCerts);
  }

  return new Promise((resolve, reject) => {
    https
      .get(GOOGLE_CERTS_URL, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Failed to fetch Google Firebase signing certs (HTTP ${res.statusCode})`));
        }

        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const cc = String(res.headers['cache-control'] || '');
            const maxAgeMatch = cc.match(/max-age=(\d+)/i);
            const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
            cachedCerts = parsed;
            certsExpiresAt = Date.now() + Math.max(60, maxAgeSec) * 1000;
            resolve(parsed);
          } catch (err) {
            reject(new Error('Invalid JSON from Google Firebase certs endpoint'));
          }
        });
      })
      .on('error', (err) => reject(err));
  });
}

/**
 * Cryptographically verifies a Firebase Client ID Token (RS256) against Google's public x509 certs.
 */
async function verifyFirebaseIdToken(idToken, expectedProjectId = FIREBASE_PROJECT_ID) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Firebase ID token is required');
  }

  const decodedComplete = jwt.decode(idToken, { complete: true });
  const kid = decodedComplete?.header?.kid;
  const alg = decodedComplete?.header?.alg;
  if (!kid || alg !== 'RS256') {
    throw new Error('Invalid Firebase ID token header');
  }

  const certs = await fetchGoogleCerts();
  const certPem = certs[kid];
  if (!certPem) {
    throw new Error('Firebase ID token signing key not recognized');
  }

  const verified = jwt.verify(idToken, certPem, {
    algorithms: ['RS256'],
    audience: expectedProjectId,
    issuer: `https://securetoken.google.com/${expectedProjectId}`
  });

  if (!verified || typeof verified !== 'object' || !verified.sub) {
    throw new Error('Invalid Firebase ID token claims');
  }

  return {
    uid: String(verified.sub),
    email: verified.email ? String(verified.email).trim().toLowerCase() : '',
    emailVerified: Boolean(verified.email_verified),
    name: verified.name ? String(verified.name) : ''
  };
}

/**
 * Verifies Bearer JWT strictly from Authorization header. Returns decoded claims or null.
 */
function verifyBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.startsWith('sb_')) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || typeof decoded !== 'object') return null;

    const uid = decoded.uid || decoded.user_id || decoded.sub;
    const shopId = decoded.shopId ? String(decoded.shopId).trim() : '';
    if (!uid || !shopId || shopId === 'default') {
      return null;
    }

    return {
      ...decoded,
      uid: String(uid),
      shopId,
      role: decoded.role || 'cashier'
    };
  } catch {
    return null;
  }
}

/**
 * Express middleware requiring a valid signed MartGPT JWT with uid and shopId.
 */
function requireAuth(req, res, next) {
  const user = verifyBearerToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Valid session token is required.' });
  }
  req.user = user;
  return next();
}

function getMasterKey() {
  return process.env.SUPERADMIN_KEY || '5145';
}

function isSuperAdminUser(user) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.email && SUPERADMIN_IDENTIFIERS.includes(String(user.email).toLowerCase())) {
    return true;
  }
  return false;
}

module.exports = {
  JWT_SECRET,
  FIREBASE_PROJECT_ID,
  SUPERADMIN_IDENTIFIERS,
  getMasterKey,
  isSuperAdminUser,
  verifyFirebaseIdToken,
  verifyBearerToken,
  requireAuth
};
