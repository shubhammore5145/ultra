// Use relative path for API so it works perfectly with Vite proxy or production
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper to get token
const getToken = () => localStorage.getItem('auth_token');

// Generic Fetch Wrapper
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data: any = {};
  const text = await response.text();
  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch (_err) {
      if (!response.ok) {
        throw new Error(`Server Error (${response.status}): Backend returned non-JSON response.`);
      }
      throw new Error(`Invalid JSON received from server: ${text.slice(0, 100)}`);
    }
  } else {
    // Empty response received
    if (!response.ok) {
      throw new Error(`Backend Error (${response.status}): No response from API server.`);
    }
    // If status is 200 with empty body (typical when static hosting returns empty on unmatched POST routes)
    throw new Error('Backend API is not reachable on this domain. If running on Render, ensure you deployed as a "Web Service" with "npm start" so the Node.js backend is active.');
  }

  if (!response.ok) {
    throw new Error(data.error || `API Request Failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  auth: {
    login: (credentials: any) => fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    signup: (data: any) => fetchAPI('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    firebaseSync: (data: any) => fetchAPI('/auth/firebase-sync', { method: 'POST', body: JSON.stringify(data) }),
    me: () => fetchAPI('/auth/me', { method: 'GET' })
  },
  products: {
    list: () => fetchAPI('/products', { method: 'GET' }),
    create: (data: any) => fetchAPI('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchAPI(`/products/${id}`, { method: 'DELETE' })
  },
  customers: {
    list: (params?: { phone?: string }) => fetchAPI('/customers' + (params?.phone ? `?phone=${encodeURIComponent(params.phone)}` : ''), { method: 'GET' }),
    create: (data: any) => fetchAPI('/customers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getLedger: (id: string) => fetchAPI(`/customers/${id}/ledger`, { method: 'GET' })
  },
  staff: {
    list: () => fetchAPI('/staff', { method: 'GET' }),
    remove: (uid: string) => fetchAPI(`/staff/${uid}`, { method: 'DELETE' })
  },
  suppliers: {
    list: () => fetchAPI('/suppliers', { method: 'GET' }),
    create: (data: any) => fetchAPI('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchAPI(`/suppliers/${id}`, { method: 'DELETE' })
  },
  purchases: {
    list: () => fetchAPI('/purchases', { method: 'GET' }),
    create: (data: any) => fetchAPI('/purchases', { method: 'POST', body: JSON.stringify(data) })
  },
  transactions: {
    list: () => fetchAPI('/transactions', { method: 'GET' }),
    create: (data: any) => fetchAPI('/transactions', { method: 'POST', body: JSON.stringify(data) })
  },
  expenses: {
    list: () => fetchAPI('/expenses', { method: 'GET' }),
    create: (data: any) => fetchAPI('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => fetchAPI(`/expenses/${id}`, { method: 'DELETE' })
  },
  udhar: {
    list: () => fetchAPI('/udhar', { method: 'GET' }),
    create: (data: any) => fetchAPI('/udhar', { method: 'POST', body: JSON.stringify(data) })
  },
  shops: {
    update: (data: any) => fetchAPI('/shops', { method: 'PUT', body: JSON.stringify(data) }),
    upgradePlan: (data: { plan: string; planExpiry?: string; couponCode?: string }) => fetchAPI('/shops/plan', { method: 'PUT', body: JSON.stringify(data) })
  },
  coupons: {
    validate: (data: { code: string; planName: string; price: number }) => fetchAPI('/coupons/validate', { method: 'POST', body: JSON.stringify(data) })
  },
  whatsapp: {
    status: () => fetchAPI('/whatsapp/status', { method: 'GET' }),
    start: () => fetchAPI('/whatsapp/start', { method: 'POST' }),
    logout: () => fetchAPI('/whatsapp/logout', { method: 'POST' }),
    send: (phone: string, message: string) => fetchAPI('/whatsapp/send', { method: 'POST', body: JSON.stringify({ phone, message }) }),
    sendBulkReminder: (customers: any[], shopName?: string) => fetchAPI('/whatsapp/bulk-reminder', { method: 'POST', body: JSON.stringify({ customers, shopName }) }),
    sendNightlySummary: (data: { shopId?: string; targetPhone?: string }) => fetchAPI('/whatsapp/nightly-summary', { method: 'POST', body: JSON.stringify(data) })
  },
  superadmin: {
    getStats: (pin?: string) => {
      const stored = localStorage.getItem('superadmin_pin');
      const key = pin || stored;
      return fetchAPI('/superadmin/stats', {
        headers: key ? { 'x-superadmin-key': key } : {}
      });
    },
    getShops: (pin?: string) => {
      const stored = localStorage.getItem('superadmin_pin');
      const key = pin || stored;
      return fetchAPI('/superadmin/shops', {
        headers: key ? { 'x-superadmin-key': key } : {}
      });
    },
    updatePlan: (shopId: string, data: { plan: string; durationDays?: number; customExpiryDate?: string }, pin?: string) => {
      const stored = localStorage.getItem('superadmin_pin');
      const key = pin || stored;
      return fetchAPI(`/superadmin/shops/${shopId}/plan`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: key ? { 'x-superadmin-key': key } : {}
      });
    },
    deleteShop: (shopId: string, pin?: string) => {
      const stored = localStorage.getItem('superadmin_pin');
      const key = pin || stored;
      return fetchAPI(`/superadmin/shops/${shopId}`, {
        method: 'DELETE',
        headers: key ? { 'x-superadmin-key': key } : {}
      });
    }
  }
};
