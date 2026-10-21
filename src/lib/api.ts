import { supabase } from './supabase';

// Use relative path for API so it works perfectly with Vite proxy or production
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper to get token
const getToken = () => localStorage.getItem('auth_token');

const getShopId = () => {
  try {
    const raw = localStorage.getItem('auth_shop');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.shopId) return parsed.shopId;
    }
  } catch (e) {}

  try {
    const rawUser = localStorage.getItem('auth_user');
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser);
      if (parsedUser?.shopId) return parsedUser.shopId;
    }
  } catch (e) {}

  const token = getToken();
  if (token && token.startsWith('sb_')) {
    try {
      const payload = JSON.parse(atob(token.slice(3)));
      if (payload?.shopId) return payload.shopId;
    } catch (e) {}
  }
  return null;
};

// Direct Supabase Fallback when backend is unreachable or on serverless
async function fallbackSupabase(endpoint: string, options: RequestInit = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const shopId = getShopId();

  // 1. Products
  if (endpoint.startsWith('/products')) {
    if (method === 'GET') {
      const q = supabase.from('products').select('*').order('name', { ascending: true });
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const row = {
        ...body,
        shopId: body.shopId || shopId,
        isLoose: Boolean(body.isLoose),
        expiryDate: body.expiryDate || null
      };
      const { data, error } = await supabase.from('products').upsert(row);
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
    if (method === 'PUT') {
      const id = endpoint.split('/products/')[1];
      const body = JSON.parse(options.body as string);
      const row = { ...body };
      if ('isLoose' in row) row.isLoose = Boolean(row.isLoose);
      if ('expiryDate' in row) row.expiryDate = row.expiryDate || null;
      if (!row.shopId && shopId) row.shopId = shopId;
      const { data, error } = await supabase.from('products').update(row).eq('id', id);
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
    // Customer full passbook/ledger
    if (endpoint.includes('/ledger')) {
      const customerId = endpoint.split('/customers/')[1].split('/ledger')[0];
      const [txRes, udharRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('customerId', customerId).order('createdAt', { ascending: false }),
        supabase.from('udhar_transactions').select('*').eq('customerId', customerId).order('createdAt', { ascending: false })
      ]);
      const sales = (txRes.data || []).map((t: any) => ({ ...t, amount: t.totalAmount, entryType: 'sale' }));
      const udhars = (udharRes.data || []).map((u: any) => ({ ...u, entryType: 'udhar' }));
      return [...sales, ...udhars].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    if (method === 'GET') {
      const q = supabase.from('customers').select('*').order('name', { ascending: true });
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const row = {
        ...body,
        shopId: body.shopId || shopId
      };
      const { data, error } = await supabase.from('customers').upsert(row);
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
    if (method === 'PUT') {
      const id = endpoint.split('/customers/')[1].split('?')[0].split('/')[0];
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('customers').update(body).eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
    if (method === 'DELETE') {
      const id = endpoint.split('/customers/')[1];
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    }
  }

  // 3. Transactions
  if (endpoint.startsWith('/transactions')) {
    if (method === 'GET') {
      const q = supabase.from('transactions').select('*').order('createdAt', { ascending: false }).limit(100);
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const txRow = {
        ...body,
        shopId: body.shopId || shopId,
        createdAt: body.createdAt || new Date().toISOString()
      };
      const { data, error } = await supabase.from('transactions').insert(txRow);
      if (error) throw new Error(error.message);

      // Reduce product stock in Supabase directly
      if (Array.isArray(body.items)) {
        for (const item of body.items) {
          if (item.id && item.qty) {
            try {
              const { data: prod } = await supabase.from('products').select('stock').eq('id', item.id).single();
              if (prod) {
                const newStock = Math.max(0, (Number(prod.stock) || 0) - Number(item.qty));
                await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
              }
            } catch (e) {}
          }
        }
      }

      // Update customer balance if udhar
      if (body.customerId && (body.paymentMethod === 'udhar' || body.paymentMethod === 'split')) {
        const udharAmount = body.paymentMethod === 'udhar' ? (Number(body.totalAmount) || 0) : (Number(body.splitAmounts?.udhar) || 0);
        if (udharAmount > 0) {
          try {
            const { data: cust } = await supabase.from('customers').select('balance, totalSpent, visits, loyaltyPoints').eq('id', body.customerId).single();
            if (cust) {
              await supabase.from('customers').update({
                balance: (Number(cust.balance) || 0) + udharAmount,
                totalSpent: (Number(cust.totalSpent) || 0) + (Number(body.totalAmount) || 0),
                visits: (Number(cust.visits) || 0) + 1,
                loyaltyPoints: (Number(cust.loyaltyPoints) || 0) + Math.floor((Number(body.totalAmount) || 0) / 100)
              }).eq('id', body.customerId);
            }
          } catch (e) {}
        }
      } else if (body.customerId) {
        try {
          const { data: cust } = await supabase.from('customers').select('totalSpent, visits, loyaltyPoints').eq('id', body.customerId).single();
          if (cust) {
            await supabase.from('customers').update({
              totalSpent: (Number(cust.totalSpent) || 0) + (Number(body.totalAmount) || 0),
              visits: (Number(cust.visits) || 0) + 1,
              loyaltyPoints: (Number(cust.loyaltyPoints) || 0) + Math.floor((Number(body.totalAmount) || 0) / 100)
            }).eq('id', body.customerId);
          }
        } catch (e) {}
      }

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
      const q = supabase.from('expenses').select('*').order('date', { ascending: false });
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
    if (method === 'DELETE') {
      const id = endpoint.split('/expenses/')[1];
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
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

      // Adjust customer balance
      if (body.customerId && body.amount) {
        try {
          const { data: cust } = await supabase.from('customers').select('balance').eq('id', body.customerId).single();
          if (cust) {
            const currentBal = Number(cust.balance) || 0;
            const amt = Number(body.amount) || 0;
            const newBal = body.type === 'payment' ? currentBal - amt : currentBal + amt;
            await supabase.from('customers').update({ balance: newBal }).eq('id', body.customerId);
          }
        } catch (e) {}
      }

      return { success: true, data };
    }
  }

  // 7. Suppliers
  if (endpoint.startsWith('/suppliers')) {
    if (method === 'GET') {
      const q = supabase.from('suppliers').select('*').order('name', { ascending: true });
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('suppliers').insert({ ...body, shopId: body.shopId || shopId });
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
    if (method === 'PUT') {
      const id = endpoint.split('/suppliers/')[1];
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('suppliers').update(body).eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
    if (method === 'DELETE') {
      const id = endpoint.split('/suppliers/')[1];
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    }
  }

  // 8. Purchases
  if (endpoint.startsWith('/purchases')) {
    if (method === 'GET') {
      const q = supabase.from('purchases').select('*').order('createdAt', { ascending: false });
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('purchases').insert({ ...body, shopId: body.shopId || shopId });
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
  }

  // 9. Shops
  if (endpoint.startsWith('/shops')) {
    if (method === 'GET') {
      const { data, error } = await supabase.from('shops').select('*').eq('shopId', shopId).single();
      if (error) throw new Error(error.message);
      return data;
    }
    if (method === 'PUT') {
      const body = JSON.parse(options.body as string);
      const { data, error } = await supabase.from('shops').update(body).eq('shopId', shopId);
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
  }

  // 10. Notifications
  if (endpoint.startsWith('/notifications')) {
    if (method === 'GET') {
      const q = supabase.from('notifications').select('*').order('createdAt', { ascending: false }).limit(50);
      const { data, error } = shopId ? await q.or(`shopId.eq.${shopId},shopId.is.null,shopId.eq.all`) : await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string || '{}');
      if (endpoint.includes('/read')) {
        const id = endpoint.split('/notifications/')[1].split('/read')[0];
        await supabase.from('notifications').update({ isRead: 1 }).eq('id', id);
        return { success: true };
      }
      const { data, error } = await supabase.from('notifications').insert({ ...body, shopId: body.shopId || shopId });
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
  }

  // 11. Login Fallback
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
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('auth_shop', JSON.stringify(shop));
    return { token: clientToken, user, shop };
  }

  // 12. Firebase Sync Fallback
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
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_shop', JSON.stringify(shop));
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
    localStorage.setItem('auth_user', JSON.stringify(userObj));
    localStorage.setItem('auth_shop', JSON.stringify(shopObj));
    return { token: clientToken, user: userObj, shop: shopObj };
  }

  // 13. Me
  if (endpoint.startsWith('/auth/me')) {
    const token = getToken();
    if (token) {
      let uid: string | null = null;
      if (token.startsWith('sb_')) {
        try {
          const payload = JSON.parse(atob(token.slice(3)));
          uid = payload.uid;
        } catch (e) {}
      }
      if (uid) {
        try {
          const { data: users } = await supabase.from('users').select('*').eq('uid', uid).limit(1);
          if (users && users.length > 0) {
            const user = users[0];
            const { data: shops } = await supabase.from('shops').select('*').eq('shopId', user.shopId).limit(1);
            const shop = shops?.[0] || { shopId: user.shopId, name: 'माझे किराणा', plan: 'free' };
            localStorage.setItem('auth_user', JSON.stringify(user));
            localStorage.setItem('auth_shop', JSON.stringify(shop));
            return { user, shop };
          }
        } catch (e) {}
      }
    }
    const rawUser = localStorage.getItem('auth_user');
    const rawShop = localStorage.getItem('auth_shop');
    if (rawUser && rawShop) {
      return { user: JSON.parse(rawUser), shop: JSON.parse(rawShop) };
    }
  }

  if (endpoint.startsWith('/whatsapp')) {
    throw new Error('WhatsApp Bot चालवण्यासाठी Node.js बॅकएंड सर्व्हर चालू असणे आवश्यक आहे. कृपया Render वर Web Service तयार करा किंवा लोकलवर सर्व्हर चालू ठेवा.');
  }

  throw new Error(`Endpoint ${endpoint} not available in direct cloud mode.`);
}

// Generic Fetch Wrapper with Automatic Supabase Fallback
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const shopId = getShopId();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(shopId ? { 'x-shop-id': shopId } : {}),
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
    delete: (id: string) => fetchAPI(`/customers/${id}`, { method: 'DELETE' }),
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
  },
  whatsapp: {
    status: (shopId?: string) => {
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/status' + (sid ? `?shopId=${encodeURIComponent(sid)}` : ''), { method: 'GET' });
    },
    start: (shopId?: string) => {
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/start', { method: 'POST', body: JSON.stringify({ shopId: sid }) });
    },
    logout: (shopId?: string) => {
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/logout', { method: 'POST', body: JSON.stringify({ shopId: sid }) });
    },
    send: (phone: string, message: string, shopId?: string) => {
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/send', { method: 'POST', body: JSON.stringify({ phone, message, shopId: sid }) });
    },
    sendBill: (phone: string, message: string, billNo?: string, shopId?: string) => {
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/send-bill', { method: 'POST', body: JSON.stringify({ phone, message, billNo, shopId: sid }) });
    },
    sendBulkReminder: (customers: any[], shopName?: string, shopId?: string) => {
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/bulk-reminder', { method: 'POST', body: JSON.stringify({ customers, shopName, shopId: sid }) });
    }
  }
};

