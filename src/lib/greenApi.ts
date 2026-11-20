/**
 * Green API Integration for WhatsApp
 * https://green-api.com
 *
 * Provides 24/7 cloud WhatsApp sending for:
 * - POS Customer Invoices & Digital Receipts
 * - Payment Reminders (Udhar Khata)
 * - Daily Sales Summaries
 * - Verification / Alert messages
 */

export interface GreenApiConfig {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl?: string; // Default: 'https://api.green-api.com'
  enabled: boolean;
}

export interface GreenApiStatus {
  state: 'authorized' | 'notAuthorized' | 'blocked' | 'sleepMode' | 'starting' | 'error' | 'not_configured';
  isAuthorized: boolean;
  phone?: string;
  pushname?: string;
  message?: string;
}

const STORAGE_KEY = 'green_api_config';
const DEFAULT_API_URL = 'https://api.green-api.com';

/**
 * Clean and format Indian phone number to Green API chatId format:
 * e.g. 9876543210 -> 919876543210@c.us
 */
export function formatGreenApiChatId(phone: string): string {
  let clean = String(phone || '').replace(/\D/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  } else if (clean.length === 11 && clean.startsWith('0')) {
    clean = '91' + clean.slice(1);
  }
  return `${clean}@c.us`;
}

/**
 * Retrieve Green API configuration from localStorage or shop settings
 */
export function getGreenApiConfig(): GreenApiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        idInstance: (parsed.idInstance || '').trim(),
        apiTokenInstance: (parsed.apiTokenInstance || '').trim(),
        apiUrl: (parsed.apiUrl || DEFAULT_API_URL).trim(),
        enabled: Boolean(parsed.enabled)
      };
    }
  } catch (err) {
    console.error('Error reading green_api_config from localStorage:', err);
  }

  // Also check if stored inside shop settings
  try {
    const authShop = localStorage.getItem('auth_shop');
    if (authShop) {
      const shop = JSON.parse(authShop);
      if (shop?.settings?.greenApi) {
        const ga = shop.settings.greenApi;
        return {
          idInstance: (ga.idInstance || '').trim(),
          apiTokenInstance: (ga.apiTokenInstance || '').trim(),
          apiUrl: (ga.apiUrl || DEFAULT_API_URL).trim(),
          enabled: Boolean(ga.enabled)
        };
      }
    }
  } catch {}

  return {
    idInstance: '',
    apiTokenInstance: '',
    apiUrl: DEFAULT_API_URL,
    enabled: false
  };
}

/**
 * Save Green API configuration to localStorage
 */
export function saveGreenApiConfig(config: Partial<GreenApiConfig>): GreenApiConfig {
  const current = getGreenApiConfig();
  const updated: GreenApiConfig = {
    ...current,
    ...config,
    idInstance: config.idInstance !== undefined ? config.idInstance.trim() : current.idInstance,
    apiTokenInstance: config.apiTokenInstance !== undefined ? config.apiTokenInstance.trim() : current.apiTokenInstance,
    apiUrl: (config.apiUrl !== undefined ? config.apiUrl.trim() : current.apiUrl) || DEFAULT_API_URL,
    enabled: config.enabled !== undefined ? Boolean(config.enabled) : current.enabled
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save green_api_config to localStorage:', err);
  }

  return updated;
}

/**
 * Check Green API authorization state
 */
export async function checkGreenApiStatus(overrideConfig?: GreenApiConfig): Promise<GreenApiStatus> {
  const conf = overrideConfig || getGreenApiConfig();

  if (!conf.idInstance || !conf.apiTokenInstance) {
    return {
      state: 'not_configured',
      isAuthorized: false,
      message: 'Green API Instance ID and Token are not configured.'
    };
  }

  // Common user mistake check: entered email address instead of numeric instance ID
  if (conf.idInstance.includes('@')) {
    return {
      state: 'error',
      isAuthorized: false,
      message: 'Invalid Instance ID! You entered an email address. Instance ID must be a numeric ID (e.g. 7103123456 or 1101000001) found inside your Green API console.'
    };
  }

  const base = (conf.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
  const url = `${base}/waInstance${conf.idInstance}/getStateInstance/${conf.apiTokenInstance}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 401) {
        return {
          state: 'error',
          isAuthorized: false,
          message: 'HTTP 401 Unauthorized: Invalid Instance ID or API Token. Please check your credentials on green-api.com.'
        };
      }
      return {
        state: 'error',
        isAuthorized: false,
        message: `HTTP ${response.status}: ${errText || response.statusText}`
      };
    }

    const data = await response.json();
    const stateInstance = data.stateInstance;

    if (stateInstance === 'authorized') {
      // Try to fetch device phone info
      let phone = '';
      let pushname = '';
      try {
        const devRes = await fetch(`${base}/waInstance${conf.idInstance}/getDeviceInfo/${conf.apiTokenInstance}`);
        if (devRes.ok) {
          const devData = await devRes.json();
          phone = devData.phone || '';
          pushname = devData.pushname || '';
        }
      } catch {}

      return {
        state: 'authorized',
        isAuthorized: true,
        phone,
        pushname,
        message: 'Green API connected and authorized! 🟢'
      };
    } else if (stateInstance === 'notAuthorized') {
      return {
        state: 'notAuthorized',
        isAuthorized: false,
        message: 'Instance not authorized. Please scan the QR code to link WhatsApp.'
      };
    } else if (stateInstance === 'blocked') {
      return {
        state: 'blocked',
        isAuthorized: false,
        message: 'Instance is blocked by WhatsApp. Check your Green API console.'
      };
    } else if (stateInstance === 'sleepMode') {
      return {
        state: 'sleepMode',
        isAuthorized: false,
        message: 'Instance is in sleep mode. Send any message or wake it in Green API console.'
      };
    } else if (stateInstance === 'starting') {
      return {
        state: 'starting',
        isAuthorized: false,
        message: 'Instance is starting up, please wait a moment...'
      };
    }

    return {
      state: (stateInstance as any) || 'error',
      isAuthorized: false,
      message: `Instance state: ${stateInstance || 'unknown'}`
    };
  } catch (err: any) {
    let msg = err.message || 'Failed to reach Green API service.';
    if (msg.includes('Failed to fetch')) {
      msg = 'Connection error (Failed to fetch). Make sure Instance ID is a numeric ID (e.g. 7103123456) and not an email address, and API Token is correct.';
    }
    return {
      state: 'error',
      isAuthorized: false,
      message: msg
    };
  }
}

/**
 * Fetch QR Code image from Green API (when state is notAuthorized)
 */
export async function getGreenApiQrCode(overrideConfig?: GreenApiConfig): Promise<{ qr: string | null; message?: string }> {
  const conf = overrideConfig || getGreenApiConfig();

  if (!conf.idInstance || !conf.apiTokenInstance) {
    return { qr: null, message: 'Please enter Instance ID and API Token first.' };
  }

  if (conf.idInstance.includes('@')) {
    return { qr: null, message: 'Invalid Instance ID! Please enter your numeric Green API idInstance, not your email address.' };
  }

  const base = (conf.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
  const url = `${base}/waInstance${conf.idInstance}/qr/${conf.apiTokenInstance}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { qr: null, message: `Failed to fetch QR: HTTP ${response.status} ${errText}` };
    }

    const data = await response.json();
    if (data.type === 'qrCode' && data.message) {
      // data.message contains the base64 string
      const raw = data.message;
      const qrDataUrl = raw.startsWith('data:image') ? raw : `data:image/png;base64,${raw}`;
      return { qr: qrDataUrl };
    } else if (data.type === 'alreadyLogged') {
      return { qr: null, message: 'Already logged in and authorized!' };
    }

    return { qr: null, message: data.message || 'Could not generate QR code.' };
  } catch (err: any) {
    return { qr: null, message: err.message || 'Failed to fetch QR code from Green API.' };
  }
}

/**
 * Logout / Unlink WhatsApp from Green API instance
 */
export async function logoutGreenApi(overrideConfig?: GreenApiConfig): Promise<{ success: boolean; message?: string }> {
  const conf = overrideConfig || getGreenApiConfig();
  if (!conf.idInstance || !conf.apiTokenInstance) return { success: false, message: 'Not configured' };

  const base = (conf.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
  const url = `${base}/waInstance${conf.idInstance}/logout/${conf.apiTokenInstance}`;

  try {
    const res = await fetch(url, { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok, message: data.message || 'Logged out' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Send a WhatsApp text message via Green API
 */
export async function sendGreenApiMessage(
  phone: string,
  message: string,
  overrideConfig?: GreenApiConfig
): Promise<{ success: boolean; idMessage?: string; error?: string }> {
  const conf = overrideConfig || getGreenApiConfig();

  if (!conf.idInstance || !conf.apiTokenInstance) {
    return { success: false, error: 'Green API is not configured (missing Instance ID or Token).' };
  }

  if (conf.idInstance.includes('@')) {
    return { success: false, error: 'Invalid Instance ID! Please enter your numeric Green API idInstance (e.g. 7103123456), NOT your email address.' };
  }

  const chatId = formatGreenApiChatId(phone);
  const base = (conf.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
  const url = `${base}/waInstance${conf.idInstance}/sendMessage/${conf.apiTokenInstance}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        chatId,
        message
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return {
        success: false,
        error: `Green API HTTP ${response.status}: ${errText || response.statusText}`
      };
    }

    const data = await response.json();
    if (data.idMessage) {
      return {
        success: true,
        idMessage: data.idMessage
      };
    }

    return {
      success: true,
      idMessage: data.idMessage || 'sent'
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to send message via Green API.'
    };
  }
}

/**
 * Send a file / document by URL via Green API
 */
export async function sendGreenApiFile(
  phone: string,
  fileUrl: string,
  fileName: string,
  caption?: string,
  overrideConfig?: GreenApiConfig
): Promise<{ success: boolean; idMessage?: string; error?: string }> {
  const conf = overrideConfig || getGreenApiConfig();

  if (!conf.idInstance || !conf.apiTokenInstance) {
    return { success: false, error: 'Green API is not configured.' };
  }

  const chatId = formatGreenApiChatId(phone);
  const base = (conf.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
  const url = `${base}/waInstance${conf.idInstance}/sendFileByUrl/${conf.apiTokenInstance}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        chatId,
        urlFile: fileUrl,
        fileName,
        caption: caption || ''
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { success: false, error: `Green API HTTP ${response.status}: ${errText}` };
    }

    const data = await response.json();
    return { success: true, idMessage: data.idMessage };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send file via Green API.' };
  }
}
