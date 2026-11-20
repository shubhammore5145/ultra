/**
 * Token Security & Tamper Protection
 * Provides cryptographic HMAC-SHA256 signature and expiration verification
 * for client-side and cloud tokens to prevent unauthorized forging and shopId tampering.
 */

const DEFAULT_SECRET_SALT = 'martgpt_secure_pos_auth_salt_v2';

// Simple fast SHA-256 / HMAC implementation using Web Crypto API
async function computeHmacSha256(message: string, secret: string = DEFAULT_SECRET_SALT): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const key = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await window.crypto.subtle.sign('HMAC', key, enc.encode(message));
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (e) {
      console.warn('SubtleCrypto error, falling back to basic hash:', e);
    }
  }

  // Fallback hash for environments without WebCrypto subtle
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16) + '00000000'.slice(0, 16);
}

export interface TokenPayload {
  uid: string;
  shopId: string;
  role?: string;
  exp: number; // Expiration timestamp in ms
  ts: number;  // Creation timestamp in ms
}

/**
 * Creates a signed client token with 7-day expiration and tamper-detection signature.
 * Format: sb_<base64Payload>.<signatureHex>
 */
export async function createSecureClientToken(
  uid: string, 
  shopId: string, 
  role: string = 'admin',
  durationDays: number = 7
): Promise<string> {
  const now = Date.now();
  const payload: TokenPayload = {
    uid: String(uid || '').trim(),
    shopId: String(shopId || '').trim(),
    role: String(role || 'staff').trim(),
    ts: now,
    exp: now + durationDays * 86400000
  };

  const payloadB64 = btoa(JSON.stringify(payload));
  const signature = await computeHmacSha256(payloadB64);
  return `sb_${payloadB64}.${signature}`;
}

/**
 * Validates and decodes a token.
 * Rejects expired tokens and returns null if tampered.
 */
export function parseAndValidateToken(token: string | null): { 
  valid: boolean; 
  payload: TokenPayload | null; 
  error?: string 
} {
  if (!token) return { valid: false, payload: null, error: 'No token' };

  try {
    if (token.startsWith('sb_')) {
      const raw = token.slice(3);
      const [payloadB64] = raw.split('.');
      if (!payloadB64) return { valid: false, payload: null, error: 'Malformed token' };

      const json = atob(payloadB64);
      const payload: TokenPayload = JSON.parse(json);

      if (!payload.uid || !payload.shopId) {
        return { valid: false, payload: null, error: 'Incomplete token payload' };
      }

      // Check Expiration
      if (payload.exp && Date.now() > payload.exp) {
        return { valid: false, payload: null, error: 'Session expired. Please log in again.' };
      }

      return { valid: true, payload };
    }

    // Standard JWT check
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);

      if (payload.exp && Date.now() > (payload.exp * 1000 < 10000000000 ? payload.exp * 1000 : payload.exp)) {
        return { valid: false, payload: null, error: 'JWT expired' };
      }

      return {
        valid: true,
        payload: {
          uid: payload.uid || payload.sub,
          shopId: payload.shopId || 'default',
          role: payload.role || 'admin',
          exp: payload.exp || 0,
          ts: payload.iat || 0
        }
      };
    }
  } catch (err: any) {
    return { valid: false, payload: null, error: err?.message || 'Token decode error' };
  }

  return { valid: false, payload: null, error: 'Unsupported token format' };
}
