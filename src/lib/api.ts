import type { DamagedItem, StockMovement, SalesReturn, CashCounterClosing } from '../types';
import { getGreenApiConfig, checkGreenApiStatus, sendGreenApiMessage, logoutGreenApi } from './greenApi';
import { parseAndValidateToken } from './tokenSecurity';
import { idbSet } from './storage';

// Use relative path for API so it works perfectly with Vite proxy or production
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper to get token
const getToken = () => localStorage.getItem('auth_token');

const getShopId = () => {
  try {
    const raw = localStorage.getItem('auth_shop');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.shopId && parsed.shopId !== 'default') return parsed.shopId;
    }
  } catch (e) {}

  try {
    const rawUser = localStorage.getItem('auth_user');
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser);
      if (parsedUser?.shopId && parsedUser.shopId !== 'default') return parsedUser.shopId;
    }
  } catch (e) {}

  const token = getToken();
  if (token) {
    const { valid, payload } = parseAndValidateToken(token);
    if (valid && payload?.shopId && payload.shopId !== 'default') return payload.shopId;
  }
  return 'mg4q6ov7ym';
};

// ── LOCAL RECYCLE BIN STORAGE (OFFLINE & CLOUD BACKUP) ─────────
export interface RecycleBinItemStorage {
  products: any[];
  transactions: any[];
  customers: any[];
}

export const RECYCLE_BIN_STORAGE_KEY = 'martgpt_recycle_bin';

export function getLocalRecycleBin(): RecycleBinItemStorage {
  try {
    const raw = localStorage.getItem(RECYCLE_BIN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        products: Array.isArray(parsed?.products) ? parsed.products : [],
        transactions: Array.isArray(parsed?.transactions) ? parsed.transactions : [],
        customers: Array.isArray(parsed?.customers) ? parsed.customers : []
      };
    }
  } catch {}
  return { products: [], transactions: [], customers: [] };
}

export function saveLocalRecycleBin(data: RecycleBinItemStorage) {
  try {
    const capped: RecycleBinItemStorage = {
      products: Array.isArray(data.products) ? data.products.slice(0, 200) : [],
      transactions: Array.isArray(data.transactions) ? data.transactions.slice(0, 200) : [],
      customers: Array.isArray(data.customers) ? data.customers.slice(0, 200) : []
    };
    localStorage.setItem(RECYCLE_BIN_STORAGE_KEY, JSON.stringify(capped));
  } catch (e) {
    console.warn('Failed to save recycle bin to localStorage:', e);
  }
}

export function addLocalRecycleItem(type: 'product' | 'transaction' | 'customer', item: any) {
  if (!item || !item.id) return;
  const bin = getLocalRecycleBin();
  const deletedItem = {
    ...item,
    isDeleted: 1,
    deletedAt: item.deletedAt || new Date().toISOString()
  };
  if (type === 'product') {
    bin.products = [deletedItem, ...bin.products.filter(p => p.id !== item.id)];
  } else if (type === 'transaction') {
    bin.transactions = [deletedItem, ...bin.transactions.filter(t => t.id !== item.id)];
  } else if (type === 'customer') {
    bin.customers = [deletedItem, ...bin.customers.filter(c => c.id !== item.id)];
  }
  saveLocalRecycleBin(bin);
}

export function removeLocalRecycleItem(type: 'product' | 'transaction' | 'customer', id: string) {
  const bin = getLocalRecycleBin();
  if (type === 'product') bin.products = bin.products.filter(p => p.id !== id);
  else if (type === 'transaction') bin.transactions = bin.transactions.filter(t => t.id !== id);
  else if (type === 'customer') bin.customers = bin.customers.filter(c => c.id !== id);
  saveLocalRecycleBin(bin);
}

// Local Product Extended Metadata (Wholesale, Rack Location, Reorder Qty, Bulk Tiers)
export function getLocalProductMeta(shopId?: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(`dmart_product_meta_${shopId || getShopId() || 'default'}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalProductMeta(productId: string, meta: any, shopId?: string) {
  try {
    const current = getLocalProductMeta(shopId);
    current[productId] = { ...(current[productId] || {}), ...meta };
    localStorage.setItem(`dmart_product_meta_${shopId || getShopId() || 'default'}`, JSON.stringify(current));
  } catch {}
}

export function getLocalDamagedGoods(shopId?: string): DamagedItem[] {
  try {
    const raw = localStorage.getItem(`dmart_damaged_${shopId || getShopId() || 'default'}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalDamagedGoods(items: DamagedItem[], shopId?: string) {
  try {
    const list = Array.isArray(items) ? items.slice(0, 500) : [];
    localStorage.setItem(`dmart_damaged_${shopId || getShopId() || 'default'}`, JSON.stringify(list));
  } catch {}
}

export function getLocalStockMovements(shopId?: string): StockMovement[] {
  try {
    const raw = localStorage.getItem(`dmart_movements_${shopId || getShopId() || 'default'}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logStockMovement(movement: StockMovement, shopId?: string) {
  try {
    const list = getLocalStockMovements(shopId);
    list.unshift(movement);
    localStorage.setItem(`dmart_movements_${shopId || getShopId() || 'default'}`, JSON.stringify(list.slice(0, 500)));
  } catch {}
}

// ── SUPER ADMIN MASTER SEED DATA (16 REGISTERED SHOPS) ───────
export interface SuperAdminShopRecord {
  shopId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address?: string | null;
  gstNumber?: string | null;
  upiId?: string | null;
  plan: string;
  planExpiry: string | null;
  createdAt: string;
  productCount: number;
  userCount: number;
  transactionCount: number;
  totalSalesVolume: number;
  status?: string;
  subscriptionStatus?: string;
  daysRemaining?: number | null;
  formattedExpiry?: string;
}

export const INITIAL_SHOPS: SuperAdminShopRecord[] = [
  { shopId: 'mg4q6ov7ym', shopName: 'SHIV SHAKATI ', ownerName: 'shubham', phone: '9226345875', email: 'shubhamvmore12@gmail.com', address: 'samta coloni shivaji nagara  waluj walyj.bk  aurangabad -431133', gstNumber: '27AABCS1429B1Z2', upiId: '9263458752@ibl', plan: 'ultra_pro', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 147, userCount: 2, transactionCount: 69, totalSalesVolume: 37257.63, subscriptionStatus: 'lifetime' },
  { shopId: 'd7n2r3emt9c', shopName: "Swapnil Jadhav's Shop", ownerName: 'Swapnil Jadhav', phone: '9421383010', email: 'sj136609@gmail.com', address: null, gstNumber: null, upiId: 'paytm.s2w4op8@pty', plan: 'free', planExpiry: null, createdAt: '2026-11-16T08:45:36+00:00', productCount: 109, userCount: 1, transactionCount: 17, totalSalesVolume: 2031, subscriptionStatus: 'free' },
  { shopId: '6mfqcog6g5', shopName: 'balaji ', ownerName: 'Shubham Namdev More', phone: '9226345875', email: 'shubham45mgm@gmail.com', address: 'samta colni shiva shi nagar walkov', gstNumber: null, upiId: '9226345875@ibl', plan: 'ultra_pro', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 5, userCount: 2, transactionCount: 12, totalSalesVolume: 12557, subscriptionStatus: 'lifetime' },
  { shopId: 'gob9j37p2vi', shopName: "TS Fitness's Shop", ownerName: 'TS Fitness', phone: '', email: 'tsfitness.waluj@gmail.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 1, userCount: 1, transactionCount: 1, totalSalesVolume: 525, subscriptionStatus: 'free' },
  { shopId: '8c7mq66vr6r', shopName: 'KiranaPro Store', ownerName: 'Shubham More', phone: '', email: 'shubham@example.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 1, userCount: 1, transactionCount: 1, totalSalesVolume: 8, subscriptionStatus: 'free' },
  { shopId: 'z693aemqc1', shopName: 'Nayashi Kirana', ownerName: 'Ramesh Kirana', phone: '', email: 'testuser2026@gmail.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 2, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'free' },
  { shopId: 'gc03m926jr4', shopName: 'Supermarket Store', ownerName: 'Test Owner', phone: '', email: 'admin@supermarket.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 1, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'free' },
  { shopId: 'qaiardtl1u', shopName: 'Shubham Namdev More Kirana', ownerName: 'Shubham Namdev More', phone: '', email: 'shubham45mgm@gmail.com', address: null, gstNumber: null, upiId: null, plan: 'ultra_pro', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 0, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'lifetime' },
  { shopId: '9dk46u4urzf', shopName: "Dishant Aarak's Shop", ownerName: 'Dishant Aarak', phone: '', email: 'dishantaarak2696@gmail.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-11-19T11:26:06+00:00', productCount: 0, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'free' },
  { shopId: '318ip4aol35', shopName: "Shubham More's Shop", ownerName: 'Shubham More', phone: '', email: 'shubhamvmore11@gmail.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 0, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'free' },
  { shopId: '11e1xqeme2cc', shopName: 'My Kirana Store', ownerName: 'shubhamvmore12', phone: '', email: 'shubhamvmore12@gmial.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-11-10T10:47:41+00:00', productCount: 0, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'free' },
  { shopId: '17k8boo302x', shopName: 'My Kirana Store', ownerName: 'Google Tester', phone: '', email: 'googleuser_1790510554179@gmail.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 0, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'free' },
  { shopId: '5xb40zq6osh', shopName: 'My Kirana Store', ownerName: 'riteh', phone: '', email: 'shubhamnmore16@gmail.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 0, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'free' },
  { shopId: 'gxpb7w8vf57', shopName: 'My Kirana Store', ownerName: 'Shop Owner', phone: '', email: 'newuser_1790510027758@gmail.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 0, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'free' },
  { shopId: 'laer32d6wwo', shopName: "Ritika Patil's Shop", ownerName: 'Ritika Patil', phone: '', email: 'ritikapatil11117@gmail.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 0, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'free' },
  { shopId: 'f5h8arrbv5j', shopName: 'riteh Kirana', ownerName: 'riteh', phone: '', email: 'shubhamnmore16@gmail.com', address: null, gstNumber: null, upiId: null, plan: 'free', planExpiry: null, createdAt: '2026-10-25T07:41:39+00:00', productCount: 0, userCount: 1, transactionCount: 0, totalSalesVolume: 0, subscriptionStatus: 'free' }
];

export function getLocalSalesReturns(shopId?: string): SalesReturn[] {
  try {
    const raw = localStorage.getItem(`dmart_returns_${shopId || getShopId() || 'default'}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalSalesReturn(ret: SalesReturn, shopId?: string) {
  try {
    const list = getLocalSalesReturns(shopId);
    list.unshift(ret);
    localStorage.setItem(`dmart_returns_${shopId || getShopId() || 'default'}`, JSON.stringify(list.slice(0, 500)));
  } catch {}
}

export function getLocalCashCounterClosings(shopId?: string): CashCounterClosing[] {
  try {
    const raw = localStorage.getItem(`dmart_shift_close_${shopId || getShopId() || 'default'}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalCashCounterClosing(closing: CashCounterClosing, shopId?: string) {
  try {
    const list = getLocalCashCounterClosings(shopId);
    list.unshift(closing);
    localStorage.setItem(`dmart_shift_close_${shopId || getShopId() || 'default'}`, JSON.stringify(list.slice(0, 365)));
  } catch {}
}

// Fast in-memory microcache (15s TTL) for product lookups
let _productsCache: { data: any[]; timestamp: number; shopId: string | null } | null = null;

export function invalidateProductsCache() {
  _productsCache = null;
}

// Generic Fetch Wrapper for MongoDB Atlas Backend
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
    throw new Error(`Unable to reach backend server (${err?.message || 'Network Error'}). Please ensure the API server is running.`);
  }

  let data: any = {};
  const text = await response.text();
  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Unexpected response from server for ${endpoint}. Please ensure the backend API is running.`);
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || `API Request Failed with status ${response.status}`);
  }

  return data;
}

// ── OFFLINE QUEUE & SYNC HELPERS ──────────────────────────────
export function getOfflineQueue(): any[] {
  try {
    const raw = localStorage.getItem('pos_offline_queue');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: any[]) {
  try {
    localStorage.setItem('pos_offline_queue', JSON.stringify(queue));
  } catch (e) {}
  idbSet('pos_offline_queue', queue).catch(() => {});
}

export async function syncOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;
  const remaining: any[] = [];

  for (const item of queue) {
    try {
      await fetchAPI('/transactions', {
        method: 'POST',
        body: JSON.stringify(item)
      });
      synced++;
    } catch (err) {
      console.warn('Could not sync offline transaction:', item.id, err);
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  return { synced, remaining: remaining.length };
}

// Auto-sync listener when browser reconnects
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Internet connection restored. Syncing offline transactions...');
    syncOfflineQueue().catch(() => {});
  });
}

export const api = {
  auth: {
    login: (credentials: any) => fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    signup: (data: any) => fetchAPI('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    firebaseSync: (data: any) => fetchAPI('/auth/firebase-sync', { method: 'POST', body: JSON.stringify(data) }),
    me: () => fetchAPI('/auth/me', { method: 'GET' })
  },
  products: {
    list: async () => {
      const now = Date.now();
      const shopId = getShopId();
      if (_productsCache && (now - _productsCache.timestamp < 15000) && _productsCache.shopId === shopId) {
        return _productsCache.data;
      }
      const res = await fetchAPI('/products', { method: 'GET' });
      if (!Array.isArray(res)) return res;
      const meta = getLocalProductMeta();
      const mapped = res.map((p: any) => {
        const m = meta[p.id];
        if (!m) return p;
        return {
          ...p,
          wholesalePrice: p.wholesalePrice ?? m.wholesalePrice ?? undefined,
          bulkMinQty: p.bulkMinQty ?? m.bulkMinQty ?? undefined,
          bulkPrice: p.bulkPrice ?? m.bulkPrice ?? undefined,
          rackLocation: p.rackLocation ?? m.rackLocation ?? undefined,
          reorderQty: p.reorderQty ?? m.reorderQty ?? undefined,
          maxStock: p.maxStock ?? m.maxStock ?? undefined,
        };
      });
      _productsCache = { data: mapped, timestamp: now, shopId };
      return mapped;
    },
    create: (data: any) => {
      if (data?.id && ('bulkMinQty' in data || 'bulkPrice' in data || 'wholesalePrice' in data)) {
        saveLocalProductMeta(data.id, {
          wholesalePrice: data.wholesalePrice,
          bulkMinQty: data.bulkMinQty,
          bulkPrice: data.bulkPrice,
          rackLocation: data.rackLocation,
          reorderQty: data.reorderQty,
          maxStock: data.maxStock
        }, data.shopId);
      }
      invalidateProductsCache();
      return fetchAPI('/products', { method: 'POST', body: JSON.stringify(data) });
    },
    update: (id: string, data: any) => {
      if ('bulkMinQty' in data || 'bulkPrice' in data || 'wholesalePrice' in data) {
        saveLocalProductMeta(id, {
          wholesalePrice: data.wholesalePrice ?? null,
          bulkMinQty: data.bulkMinQty ?? null,
          bulkPrice: data.bulkPrice ?? null,
          rackLocation: data.rackLocation ?? null,
          reorderQty: data.reorderQty ?? null,
          maxStock: data.maxStock ?? null
        }, data.shopId);
      }
      invalidateProductsCache();
      return fetchAPI(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete: async (id: string, itemData?: any) => {
      if (itemData) {
        addLocalRecycleItem('product', itemData);
      }
      return fetchAPI(`/products/${id}`, { method: 'DELETE' });
    }
  },
  customers: {
    list: (params?: { phone?: string }) => fetchAPI('/customers' + (params?.phone ? `?phone=${encodeURIComponent(params.phone)}` : ''), { method: 'GET' }),
    create: (data: any) => fetchAPI('/customers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: async (id: string, itemData?: any) => {
      if (itemData) {
        addLocalRecycleItem('customer', itemData);
      }
      return fetchAPI(`/customers/${id}`, { method: 'DELETE' });
    },
    getLedger: (id: string) => fetchAPI(`/customers/${id}/ledger`, { method: 'GET' })
  },
  staff: {
    list: () => fetchAPI('/staff', { method: 'GET' }),
    remove: (uid: string) => fetchAPI(`/staff/${uid}`, { method: 'DELETE' }),
    updatePermissions: (uid: string, permissions: string[]) => 
      fetchAPI(`/staff/${uid}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) })
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
    list: async () => {
      let list: any[] = [];
      try {
        const res = await fetchAPI('/transactions', { method: 'GET' });
        if (Array.isArray(res)) list = res;
      } catch (e) {
        console.warn('Failed to fetch server transactions:', e);
      }
      // Always merge any pending offline bills from localStorage so they are immediately visible
      const offline = getOfflineQueue();
      const existingIds = new Set(list.map((t: any) => t.id));
      for (const item of offline) {
        if (item && item.id && !existingIds.has(item.id)) {
          list.unshift({ ...item, isOffline: true });
          existingIds.add(item.id);
        }
      }
      return list;
    },
    create: async (data: any) => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error('Offline');
        }
        return await fetchAPI('/transactions', { method: 'POST', body: JSON.stringify(data) });
      } catch (err: any) {
        console.warn('Network issue during checkout. Storing transaction in offline queue:', err.message);
        const queue = getOfflineQueue();
        const offlineItem = {
          ...data,
          id: data.id || ('off_' + Date.now().toString(36)),
          createdAt: data.createdAt || new Date().toISOString(),
          isOffline: true
        };
        queue.push(offlineItem);
        saveOfflineQueue(queue);
        return { success: true, data: offlineItem, offline: true };
      }
    },
    delete: async (id: string, permanent?: boolean, itemData?: any) => {
      if (itemData && !permanent) {
        addLocalRecycleItem('transaction', itemData);
      }
      return fetchAPI(`/transactions/${id}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' });
    }
  },
  staffMembers: {
    list: () => fetchAPI('/staff-members', { method: 'GET' }),
    create: (data: any) => fetchAPI('/staff-members', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/staff-members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchAPI(`/staff-members/${id}`, { method: 'DELETE' })
  },
  staffAttendance: {
    list: (params?: { month?: string; date?: string; staffId?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return fetchAPI('/staff-attendance' + (q ? `?${q}` : ''), { method: 'GET' });
    },
    mark: (records: any) => fetchAPI('/staff-attendance', { method: 'POST', body: JSON.stringify(records) })
  },
  staffSalary: {
    list: (params?: { staffId?: string; monthYear?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return fetchAPI('/staff-salary-payments' + (q ? `?${q}` : ''), { method: 'GET' });
    },
    create: (data: any) => fetchAPI('/staff-salary-payments', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => fetchAPI(`/staff-salary-payments/${id}`, { method: 'DELETE' })
  },
  recycleBin: {
    list: async () => {
      let res: any = { products: [], transactions: [], customers: [] };
      try {
        res = await fetchAPI('/recycle-bin', { method: 'GET' });
      } catch (e) {
        console.warn('Backend recycle bin list call error, relying on local backup:', e);
      }
      const local = getLocalRecycleBin();
      const merge = (cloudList: any[] = [], localList: any[] = []) => {
        const map = new Map();
        [...(cloudList || []), ...(localList || [])].forEach(it => {
          if (it && it.id) map.set(it.id, it);
        });
        return Array.from(map.values()).sort((a: any, b: any) => {
          const tA = new Date(a.deletedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.deletedAt || b.createdAt || 0).getTime();
          return tB - tA;
        });
      };
      return {
        products: merge(res?.products, local.products),
        transactions: merge(res?.transactions, local.transactions),
        customers: merge(res?.customers, local.customers)
      };
    },
    restore: async (type: 'product' | 'transaction' | 'customer', id: string) => {
      removeLocalRecycleItem(type, id);
      return fetchAPI('/recycle-bin/restore', { method: 'POST', body: JSON.stringify({ type, id }) });
    },
    purge: async (type: 'product' | 'transaction' | 'customer', id: string) => {
      removeLocalRecycleItem(type, id);
      return fetchAPI('/recycle-bin/purge', { method: 'POST', body: JSON.stringify({ type, id }) });
    },
    empty: async () => {
      saveLocalRecycleBin({ products: [], transactions: [], customers: [] });
      return fetchAPI('/recycle-bin/empty', { method: 'POST' });
    }
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
    status: async (shopId?: string) => {
      const greenConf = getGreenApiConfig();
      if (greenConf.enabled && greenConf.idInstance && greenConf.apiTokenInstance) {
        try {
          const st = await checkGreenApiStatus(greenConf);
          return {
            status: st.isAuthorized ? 'CONNECTED' : (st.state === 'notAuthorized' ? 'NEEDS_QR' : 'DISCONNECTED'),
            provider: 'green_api',
            info: { phone: st.phone || '', pushname: st.pushname || 'Green API' },
            error: st.isAuthorized ? null : st.message
          };
        } catch (e: any) {
          console.warn('Green API status check error:', e.message);
        }
      }
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/status' + (sid ? `?shopId=${encodeURIComponent(sid)}` : ''), { method: 'GET' });
    },
    start: (shopId?: string) => {
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/start', { method: 'POST', body: JSON.stringify({ shopId: sid }) });
    },
    logout: async (shopId?: string) => {
      const greenConf = getGreenApiConfig();
      if (greenConf.enabled && greenConf.idInstance) {
        try {
          await logoutGreenApi(greenConf);
        } catch (e: any) {
          console.warn('Green API logout error:', e.message);
        }
      }
      const sid = shopId || getShopId();
      try {
        return await fetchAPI('/whatsapp/logout', { method: 'POST', body: JSON.stringify({ shopId: sid }) });
      } catch {
        return { success: true };
      }
    },
    send: async (phone: string, message: string, shopId?: string) => {
      const greenConf = getGreenApiConfig();
      if (greenConf.enabled && greenConf.idInstance && greenConf.apiTokenInstance) {
        const res = await sendGreenApiMessage(phone, message, greenConf);
        if (res.success) {
          return { success: true, message: 'Message sent via Green API', idMessage: res.idMessage };
        }
        throw new Error(res.error || 'Failed to send message via Green API');
      }
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/send', { method: 'POST', body: JSON.stringify({ phone, message, shopId: sid }) });
    },
    sendBill: async (phone: string, message: string, billNo?: string, shopId?: string) => {
      const greenConf = getGreenApiConfig();
      if (greenConf.enabled && greenConf.idInstance && greenConf.apiTokenInstance) {
        const res = await sendGreenApiMessage(phone, message, greenConf);
        if (res.success) {
          return { success: true, message: `WhatsApp bill #${billNo || ''} sent to +91 ${phone} via Green API`, idMessage: res.idMessage };
        }
        throw new Error(res.error || 'Failed to send bill via Green API');
      }
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/send-bill', { method: 'POST', body: JSON.stringify({ phone, message, billNo, shopId: sid }) });
    },
    sendBulkReminder: async (customers: any[], shopName?: string, shopId?: string) => {
      const greenConf = getGreenApiConfig();
      if (greenConf.enabled && greenConf.idInstance && greenConf.apiTokenInstance) {
        const results = { total: customers.length, sent: 0, failed: 0, details: [] as any[] };
        for (const c of customers) {
          if (!c.phone) {
            results.failed++;
            continue;
          }
          const bal = Number(c.balance || c.udhar || 0);
          const msg = `Namaste ${c.name} ji,\nThis is a gentle payment reminder from *${shopName || 'our store'}*.\nYour outstanding udhar balance is *₹${bal.toLocaleString('en-IN')}*.\nPlease clear the dues at your earliest convenience.\nThank you! 🙏`;
          const res = await sendGreenApiMessage(c.phone, msg, greenConf);
          if (res.success) {
            results.sent++;
            results.details.push({ name: c.name, phone: c.phone, status: 'sent' });
          } else {
            results.failed++;
            results.details.push({ name: c.name, phone: c.phone, status: 'failed', error: res.error });
          }
          await new Promise(r => setTimeout(r, 600)); // anti-spam throttle
        }
        return results;
      }
      const sid = shopId || getShopId();
      return fetchAPI('/whatsapp/bulk-reminder', { method: 'POST', body: JSON.stringify({ customers, shopName, shopId: sid }) });
    },
    sendNightlySummary: async (data: { shopId?: string; targetPhone?: string; summaryText?: string }) => {
      const greenConf = getGreenApiConfig();
      if (greenConf.enabled && greenConf.idInstance && greenConf.apiTokenInstance && data.targetPhone && data.summaryText) {
        const res = await sendGreenApiMessage(data.targetPhone, data.summaryText, greenConf);
        if (res.success) {
          return { success: true, message: `Nightly summary sent to ${data.targetPhone} via Green API` };
        }
      }
      return fetchAPI('/whatsapp/nightly-summary', { method: 'POST', body: JSON.stringify(data) });
    }
  },
  damagedGoods: {
    list: async () => getLocalDamagedGoods(),
    create: async (item: DamagedItem) => {
      const list = getLocalDamagedGoods();
      list.unshift(item);
      saveLocalDamagedGoods(list);
      return item;
    },
    delete: async (id: string) => {
      const list = getLocalDamagedGoods().filter(d => d.id !== id);
      saveLocalDamagedGoods(list);
      return { success: true };
    }
  },
  stockMovements: {
    list: async () => getLocalStockMovements(),
    log: async (m: StockMovement) => {
      logStockMovement(m);
      return m;
    }
  },
  salesReturns: {
    list: async () => getLocalSalesReturns(),
    create: async (ret: SalesReturn) => {
      saveLocalSalesReturn(ret);
      return ret;
    }
  },
  cashCounter: {
    list: async () => getLocalCashCounterClosings(),
    closeShift: async (closing: CashCounterClosing) => {
      saveLocalCashCounterClosing(closing);
      return closing;
    }
  },
  superadmin: {
    getStats: async (key?: string) => {
      const masterKey = key || sessionStorage.getItem('martgpt_superadmin_key') || '5145';
      return fetchAPI(`/superadmin/stats?key=${encodeURIComponent(masterKey)}`, {
        headers: { 'x-superadmin-key': masterKey }
      });
    },
    getShops: async (key?: string) => {
      const masterKey = key || sessionStorage.getItem('martgpt_superadmin_key') || '5145';
      return fetchAPI(`/superadmin/shops?key=${encodeURIComponent(masterKey)}`, {
        headers: { 'x-superadmin-key': masterKey }
      });
    },
    updatePlan: async (
      shopId: string, 
      data: { plan: string; durationDays?: number | null; customExpiry?: string | null }, 
      key?: string
    ) => {
      const masterKey = key || sessionStorage.getItem('martgpt_superadmin_key') || '5145';
      return fetchAPI(`/superadmin/shops/${shopId}/plan?key=${encodeURIComponent(masterKey)}`, {
        method: 'PUT',
        headers: { 'x-superadmin-key': masterKey },
        body: JSON.stringify(data)
      });
    },
    deleteShop: async (shopId: string, key?: string) => {
      const masterKey = key || sessionStorage.getItem('martgpt_superadmin_key') || '5145';
      return fetchAPI(`/superadmin/shops/${shopId}?key=${encodeURIComponent(masterKey)}`, {
        method: 'DELETE',
        headers: { 'x-superadmin-key': masterKey }
      });
    },
    impersonate: async (shopId: string, key?: string) => {
      const masterKey = key || sessionStorage.getItem('martgpt_superadmin_key') || '5145';
      return fetchAPI(`/superadmin/impersonate/${shopId}?key=${encodeURIComponent(masterKey)}`, {
        method: 'POST',
        headers: { 'x-superadmin-key': masterKey }
      });
    }
  }
};

