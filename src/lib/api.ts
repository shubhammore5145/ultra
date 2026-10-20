import { supabase } from './supabase';

// Use relative path for API so it works perfectly with Vite proxy or production
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper to get token
const getToken = () => localStorage.getItem('auth_token');

const getShopId = () => {
  try {
    const raw = localStorage.getItem('auth_shop');
    return raw ? JSON.parse(raw)?.shopId : null;
  } catch (e) {
    return null;
  }
};

// Direct Supabase Fallback when backend is unreachable or on serverless
async function fallbackSupabase(endpoint: string, options: RequestInit = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const shopId = getShopId();

  // 1. Products
  if (endpoint.startsWith('/products')) {
    if (method === 'GET') {
      const q = supabase.from('products').select('*');
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('products').upsert({ ...body, shopId: body.shopId || shopId });
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
    if (method === 'PUT') {
      const id = endpoint.split('/products/')[1];
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('products').update(body).eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
    if (method === 'DELETE') {
      const id = endpoint.split('/products/')[1];
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    }
  }

  // 2. Customers
  if (endpoint.startsWith('/customers')) {
    if (method === 'GET') {
      const q = supabase.from('customers').select('*');
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('customers').upsert({ ...body, shopId: body.shopId || shopId });
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
    if (method === 'PUT') {
      const id = endpoint.split('/customers/')[1];
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('customers').update(body).eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
  }

  // 3. Transactions
  if (endpoint.startsWith('/transactions')) {
    if (method === 'GET') {
      const q = supabase.from('transactions').select('*').order('createdAt', { ascending: false });
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('transactions').insert({ ...body, shopId: body.shopId || shopId });
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
  }

  // 4. Public Receipt
  if (endpoint.startsWith('/public/receipt/')) {
    const id = endpoint.split('/public/receipt/')[1];
    const { data: tx } = await supabase.from('transactions').select('*').or(`id.eq.${id},id.ilike.%${id}`).limit(1);
    if (!tx || tx.length === 0) throw new Error('Receipt not found');
    const t = tx[0];
    const { data: sh } = await supabase.from('shops').select('*').eq('shopId', t.shopId).limit(1);
    const { data: cu } = t.customerId ? await supabase.from('customers').select('*').eq('id', t.customerId).limit(1) : { data: [] };
    return {
      ...t,
      shopName: sh?.[0]?.name,
      shopPhone: sh?.[0]?.phone,
      shopAddress: sh?.[0]?.address,
      shopGstNumber: sh?.[0]?.gstNumber,
      customerName: cu?.[0]?.name,
      customerPhone: cu?.[0]?.phone
    };
  }

  // 5. Expenses
  if (endpoint.startsWith('/expenses')) {
    if (method === 'GET') {
      const q = supabase.from('expenses').select('*').order('createdAt', { ascending: false });
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('expenses').insert({ ...body, shopId: body.shopId || shopId });
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
  }

  // 6. Udhar
  if (endpoint.startsWith('/udhar')) {
    if (method === 'GET') {
      const q = supabase.from('udhar_transactions').select('*').order('createdAt', { ascending: false });
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('udhar_transactions').insert({ ...body, shopId: body.shopId || shopId });
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
  }

  // 7. Login Fallback
  if (endpoint.startsWith('/auth/login')) {
    const body = JSON.parse(options.body as string);
    const cleanEmail = (body.email || '').trim().toLowerCase();
    const { data: users, error: uErr } = await supabase.from('users').select('*').ilike('email', cleanEmail).limit(1);
    if (uErr || !users || users.length === 0) {
      throw new Error('या ईमेलने नोंदणीकृत युझर सापडला नाही. कृपया आधी Sign Up करा.');
    }
    const user = users[0];
    const { data: shops } = await supabase.from('shops').select('*').eq('shopId', user.shopId).limit(1);
    const shop = shops?.[0] || { shopId: user.shopId, name: 'माझे किराणा', plan: 'free' };
    delete user.password;
    const clientToken = 'sb_' + btoa(JSON.stringify({ uid: user.uid, shopId: user.shopId, exp: Date.now() + 7 * 86400000 }));
    return { token: clientToken, user, shop };
  }

  // 8. Firebase Sync Fallback
  if (endpoint.startsWith('/auth/firebase-sync')) {
    const body = JSON.parse(options.body as string);
    const cleanEmail = (body.email || '').trim().toLowerCase();
    const uid = body.uid;
    const displayName = body.displayName || cleanEmail.split('@')[0];

    // Find user in Supabase
    let user: any = null;
    const { data: byUid } = await supabase.from('users').select('*').eq('uid', uid).limit(1);
    if (byUid && byUid.length > 0) {
      user = byUid[0];
    } else {
      const { data: byEmail } = await supabase.from('users').select('*').ilike('email', cleanEmail).limit(1);
      if (byEmail && byEmail.length > 0) {
        user = byEmail[0];
        await supabase.from('users').update({ uid }).eq('email', cleanEmail).catch(() => {});
        user.uid = uid;
      }
    }

    if (user) {
      const { data: shops } = await supabase.from('shops').select('*').eq('shopId', user.shopId).limit(1);
      const shop = shops?.[0] || { shopId: user.shopId, name: 'माझे किराणा', plan: 'free' };
      delete user.password;
      const clientToken = 'sb_' + btoa(JSON.stringify({ uid: user.uid, shopId: user.shopId, exp: Date.now() + 7 * 86400000 }));
      return { token: clientToken, user, shop };
    }

    // New user in Supabase
    const newShopId = body.shopId || 'shop_' + Date.now().toString(36);
    const shopObj = {
      shopId: newShopId,
      name: body.shopName || (displayName ? `${displayName} किराणा` : 'माझे किराणा स्टोअर'),
      ownerName: body.ownerName || displayName,
      email: cleanEmail,
      plan: 'free'
    };
    await supabase.from('shops').insert(shopObj).catch(() => {});

    const userObj = {
      uid,
      email: cleanEmail,
      displayName,
      role: body.role || 'admin',
      shopId: newShopId
    };
    await supabase.from('users').insert(userObj).catch(() => {});

    const clientToken = 'sb_' + btoa(JSON.stringify({ uid, shopId: newShopId, exp: Date.now() + 7 * 86400000 }));
    return { token: clientToken, user: userObj, shop: shopObj };
  }

  // 9. Me
  if (endpoint.startsWith('/auth/me')) {
    const rawUser = localStorage.getItem('auth_user');
    const rawShop = localStorage.getItem('auth_shop');
    if (rawUser && rawShop) {
      return { user: JSON.parse(rawUser), shop: JSON.parse(rawShop) };
    }
  }

  throw new Error(`Endpoint ${endpoint} not available in direct cloud mode.`);
}

// Generic Fetch Wrapper with Automatic Supabase Fallback
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    console.warn(`Backend fetch failed for ${endpoint}, switching to direct Supabase cloud:`, err.message);
    return fallbackSupabase(endpoint, options);
  }

  let data: any = {};
  const text = await response.text();
  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch (_err) {
      // If server returned HTML (e.g. Vercel /index.html rewrite)
      console.warn(`Non-JSON response from ${endpoint}, falling back to direct Supabase cloud`);
      return fallbackSupabase(endpoint, options);
    }
  } else {
    // Empty response received
    return fallbackSupabase(endpoint, options);
  }

  if (!response.ok) {
    console.warn(`Backend returned status ${response.status} for ${endpoint}, trying direct Supabase fallback`);
    try {
      return await fallbackSupabase(endpoint, options);
    } catch (_fallbackErr) {
      throw new Error(data.error || `API Request Failed with status ${response.status}`);
    }
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
  notifications: {
    list: (unreadOnly?: boolean) => fetchAPI('/notifications' + (unreadOnly ? '?unreadOnly=true' : ''), { method: 'GET' }),
    markAsRead: (id: string) => fetchAPI(`/notifications/${id}/read`, { method: 'POST' }),
    markAllAsRead: () => fetchAPI('/notifications/read-all', { method: 'POST' })
  }
};
