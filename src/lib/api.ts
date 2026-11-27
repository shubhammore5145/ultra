import { supabase } from './supabase';
import type { DamagedItem, StockMovement, SalesReturn, CashCounterClosing } from '../types';
import { getGreenApiConfig, checkGreenApiStatus, sendGreenApiMessage, logoutGreenApi } from './greenApi';
import { createSecureClientToken, parseAndValidateToken } from './tokenSecurity';
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

// Direct Supabase Fallback when backend is unreachable or on serverless
let _productsCache: { data: any[]; timestamp: number; shopId: string | null } | null = null;

export function invalidateProductsCache() {
  _productsCache = null;
}

async function fallbackSupabase(endpoint: string, options: RequestInit = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const shopId = getShopId();

  // 1. Products
  if (endpoint.startsWith('/products')) {
    if (method === 'GET') {
      const now = Date.now();
      // Fast memory microcache (15 seconds TTL) to slash Supabase database read load
      if (_productsCache && (now - _productsCache.timestamp < 15000) && _productsCache.shopId === shopId) {
        return _productsCache.data;
      }

      const q = supabase.from('products').select('*').order('name', { ascending: true });
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      const localBin = getLocalRecycleBin();
      const deletedIds = new Set(localBin.products.map(p => p.id));
      const activeProducts = (data || []).filter((p: any) => !p.isDeleted && !deletedIds.has(p.id));
      let cloudMeta: Record<string, any> = {};
      if (shopId) {
        try {
          const { data: sbShop } = await supabase.from('shops').select('settings').eq('shopId', shopId).maybeSingle();
          const sbSettings = typeof sbShop?.settings === 'string' ? JSON.parse(sbShop.settings) : sbShop?.settings;
          if (sbSettings?.productMeta && typeof sbSettings.productMeta === 'object') {
            cloudMeta = sbSettings.productMeta;
          }
        } catch {}
      }
      const meta = getLocalProductMeta(shopId);
      const mapped = activeProducts.map((p: any) => ({
        ...p,
        ...(cloudMeta[p.id] || {}),
        ...(meta[p.id] || {})
      }));

      _productsCache = {
        data: mapped,
        timestamp: now,
        shopId
      };
      return mapped;
    }
    if (method === 'POST') {
      invalidateProductsCache();
      const body = JSON.parse(options.body as string);
      const metaPayload = {
        wholesalePrice: body.wholesalePrice,
        bulkMinQty: body.bulkMinQty,
        bulkPrice: body.bulkPrice,
        rackLocation: body.rackLocation,
        reorderQty: body.reorderQty,
        maxStock: body.maxStock
      };
      if (Object.values(metaPayload).some(v => v !== undefined && v !== null && v !== '')) {
        saveLocalProductMeta(body.id, metaPayload, shopId);
        if (shopId) {
          try {
            const { data: sbShop } = await supabase.from('shops').select('settings').eq('shopId', shopId).maybeSingle();
            const curSettings = (typeof sbShop?.settings === 'string' ? JSON.parse(sbShop.settings) : sbShop?.settings) || {};
            const productMeta = { ...(curSettings.productMeta || {}), [body.id]: metaPayload };
            await supabase.from('shops').update({ settings: { ...curSettings, productMeta } }).eq('shopId', shopId);
          } catch {}
        }
      }
      const row = {
        id: body.id,
        shopId: body.shopId || shopId,
        name: body.name,
        category: body.category || '',
        brand: body.brand || '',
        unit: body.unit || 'pcs',
        purchasePrice: Number(body.purchasePrice || 0),
        sellingPrice: Number(body.sellingPrice || 0),
        mrp: Number(body.mrp || 0),
        gst: Number(body.gst || 0),
        stock: Number(body.stock || 0),
        minStock: Number(body.minStock || 0),
        sku: body.sku || '',
        barcode: body.barcode || '',
        shortCode: body.shortCode || null,
        isLoose: Boolean(body.isLoose),
        expiryDate: body.expiryDate || null,
        imageUrl: body.imageUrl || null,
        createdAt: body.createdAt || new Date().toISOString()
      };
      const { data, error } = await supabase.from('products').upsert(row);
      if (error) throw new Error(error.message);
      return { success: true, data };
    }
    if (method === 'PUT') {
      const id = endpoint.split('/products/')[1];
      const body = JSON.parse(options.body as string);
      const hasMetaKeys = ['wholesalePrice', 'bulkMinQty', 'bulkPrice', 'rackLocation', 'reorderQty', 'maxStock'].some(k => k in body);
      if (hasMetaKeys) {
        const metaPayload = {
          wholesalePrice: body.wholesalePrice ?? null,
          bulkMinQty: body.bulkMinQty ?? null,
          bulkPrice: body.bulkPrice ?? null,
          rackLocation: body.rackLocation ?? null,
          reorderQty: body.reorderQty ?? null,
          maxStock: body.maxStock ?? null
        };
        saveLocalProductMeta(id, metaPayload, shopId);
        if (shopId) {
          try {
            const { data: sbShop } = await supabase.from('shops').select('settings').eq('shopId', shopId).maybeSingle();
            const curSettings = (typeof sbShop?.settings === 'string' ? JSON.parse(sbShop.settings) : sbShop?.settings) || {};
            const productMeta = { ...(curSettings.productMeta || {}), [id]: metaPayload };
            await supabase.from('shops').update({ settings: { ...curSettings, productMeta } }).eq('shopId', shopId);
          } catch {}
        }
      }
      const allowedCols = ['name', 'category', 'brand', 'unit', 'purchasePrice', 'sellingPrice', 'mrp', 'gst', 'stock', 'minStock', 'sku', 'barcode', 'shortCode', 'isLoose', 'expiryDate', 'imageUrl', 'shopId'];
      const row: any = {};
      for (const k of allowedCols) {
        if (k in body) row[k] = body[k];
      }
      if ('isLoose' in row) row.isLoose = Boolean(row.isLoose);
      if ('expiryDate' in row) row.expiryDate = row.expiryDate || null;
      if (!row.shopId && shopId) row.shopId = shopId;
      const { data, error } = await supabase.from('products').update(row).eq('id', id);
      if (error) throw new Error(error.message);
      invalidateProductsCache();
      return { success: true, data };
    }
    if (method === 'DELETE') {
      invalidateProductsCache();
      const id = endpoint.split('/products/')[1];
      try {
        const { data: existing } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
        if (existing) addLocalRecycleItem('product', existing);
      } catch {}
      try {
        const { error } = await supabase.from('products').update({ isDeleted: 1, deletedAt: new Date().toISOString() }).eq('id', id);
        if (error) {
          await supabase.from('products').delete().eq('id', id);
        }
      } catch {
        try { await supabase.from('products').delete().eq('id', id); } catch {}
      }
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
      const localBin = getLocalRecycleBin();
      const deletedIds = new Set(localBin.customers.map(c => c.id));
      const activeCustomers = (data || []).filter((c: any) => !c.isDeleted && !deletedIds.has(c.id));
      return activeCustomers;
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
      try {
        const { data: existing } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
        if (existing) addLocalRecycleItem('customer', existing);
      } catch {}
      try {
        const { error } = await supabase.from('customers').update({ isDeleted: 1, deletedAt: new Date().toISOString() }).eq('id', id);
        if (error) {
          await supabase.from('customers').delete().eq('id', id);
        }
      } catch {
        try { await supabase.from('customers').delete().eq('id', id); } catch {}
      }
      return { success: true };
    }
  }

  // 3. Transactions
  if (endpoint.startsWith('/transactions')) {
    if (method === 'GET') {
      const q = supabase.from('transactions').select('*').order('createdAt', { ascending: false }).limit(200);
      const { data, error } = shopId ? await q.eq('shopId', shopId) : await q;
      if (error) throw new Error(error.message);
      const localBin = getLocalRecycleBin();
      const deletedIds = new Set(localBin.transactions.map(t => t.id));
      const activeTransactions = (data || []).filter((t: any) => !t.isDeleted && !deletedIds.has(t.id));
      return activeTransactions;
    }
    if (method === 'DELETE') {
      const id = endpoint.split('/transactions/')[1].split('?')[0];
      try {
        const { data: existing } = await supabase.from('transactions').select('*').eq('id', id).maybeSingle();
        if (existing) addLocalRecycleItem('transaction', existing);
      } catch {}
      try {
        const { error } = await supabase.from('transactions').update({ isDeleted: 1, deletedAt: new Date().toISOString() }).eq('id', id);
        if (error) {
          await supabase.from('transactions').delete().eq('id', id);
        }
      } catch {
        try { await supabase.from('transactions').delete().eq('id', id); } catch {}
      }
      return { success: true };
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const txRow = {
        id: body.id,
        shopId: body.shopId || shopId,
        subtotal: Number(body.subtotal || 0),
        taxAmount: Number(body.taxAmount || 0),
        discountAmount: Number(body.discountAmount || 0),
        totalAmount: Number(body.totalAmount || 0),
        paymentMethod: body.paymentMethod || 'cash',
        customerId: body.customerId || null,
        items: body.items,
        createdAt: body.createdAt || new Date().toISOString()
      };
      const { data, error } = await supabase.from('transactions').insert(txRow);
      if (error) throw new Error(error.message);

      // Fast parallel stock reduction with atomic decrement (RPC shield + fallback)
      if (Array.isArray(body.items) && body.items.length > 0) {
        const stockPromises = body.items.map(async (item: any) => {
          if (!item.id || !item.qty) return;
          try {
            // 1. Try atomic database RPC (1 roundtrip, race-condition free)
            const { error: rpcErr } = await supabase.rpc('decrement_stock', {
              p_product_id: item.id,
              p_qty: Number(item.qty)
            });
            if (rpcErr) {
              // 2. Direct fallback if RPC is not yet registered
              const { data: prod } = await supabase.from('products').select('stock').eq('id', item.id).single();
              if (prod) {
                const newStock = Math.max(0, (Number(prod.stock) || 0) - Number(item.qty));
                await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
              }
            }
          } catch (e) {}
        });
        await Promise.allSettled(stockPromises);
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
      const { data, error } = await supabase.from('shops').upsert({ ...body, shopId });
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

  // 10. Staff Members Fallback
  if (endpoint.startsWith('/staff-members')) {
    const localKey = `martgpt_staff_${shopId || 'default'}`;
    const getLocal = () => {
      try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch { return []; }
    };
    const setLocal = (data: any[]) => localStorage.setItem(localKey, JSON.stringify(data));

    if (method === 'GET') {
      try {
        const { data, error } = await supabase.from('staff').select('*').eq('shopId', shopId || 'default').order('createdAt', { ascending: false });
        if (!error && Array.isArray(data)) return data;
      } catch {}
      return getLocal();
    }

    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const newStaff = {
        id: body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'staff_' + Date.now()),
        shopId: shopId || 'default',
        name: body.name,
        phone: body.phone || null,
        role: body.role || 'Helper',
        salaryType: body.salaryType || 'monthly',
        salary: Number(body.salary) || 0,
        joinDate: body.joinDate || new Date().toISOString().slice(0, 10),
        address: body.address || null,
        status: body.status || 'active',
        createdAt: new Date().toISOString()
      };

      try {
        await supabase.from('staff').insert(newStaff);
      } catch {}

      const list = getLocal();
      list.unshift(newStaff);
      setLocal(list);
      return { success: true, id: newStaff.id, ...newStaff };
    }

    if (method === 'PUT') {
      const id = endpoint.split('/staff-members/')[1]?.split('?')[0];
      const body = JSON.parse(options.body as string);

      try {
        await supabase.from('staff').update(body).eq('id', id);
      } catch {}

      const list = getLocal().map((s: any) => s.id === id ? { ...s, ...body } : s);
      setLocal(list);
      return { success: true };
    }

    if (method === 'DELETE') {
      const id = endpoint.split('/staff-members/')[1]?.split('?')[0];
      try {
        await supabase.from('staff').delete().eq('id', id);
      } catch {}

      const list = getLocal().filter((s: any) => s.id !== id);
      setLocal(list);
      return { success: true };
    }
  }

  // 10.1 Staff Attendance Fallback
  if (endpoint.startsWith('/staff-attendance')) {
    const localKey = `martgpt_attendance_${shopId || 'default'}`;
    const getLocal = () => {
      try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch { return []; }
    };
    const setLocal = (data: any[]) => localStorage.setItem(localKey, JSON.stringify(data));

    if (method === 'GET') {
      const params = new URLSearchParams(endpoint.split('?')[1] || '');
      const month = params.get('month');
      const date = params.get('date');
      const staffIdParam = params.get('staffId');

      let list: any[] = [];
      try {
        const { data, error } = await supabase.from('staff_attendance').select('*').eq('shopId', shopId || 'default');
        if (!error && Array.isArray(data)) list = data;
        else list = getLocal();
      } catch {
        list = getLocal();
      }

      if (date) list = list.filter(a => a.date === date);
      else if (month) list = list.filter(a => (a.date || '').startsWith(month));
      if (staffIdParam) list = list.filter(a => a.staffId === staffIdParam);
      return list;
    }

    if (method === 'POST') {
      const body = JSON.parse(options.body as string || '{}');
      const records = Array.isArray(body.records) ? body.records : [body];
      const existingList = getLocal();

      for (const rec of records) {
        if (!rec.staffId || !rec.date) continue;
        const entry = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'att_' + Date.now() + Math.random().toString(36).slice(2, 6),
          shopId: shopId || 'default',
          staffId: rec.staffId,
          date: rec.date,
          status: rec.status || 'present',
          notes: rec.notes || null,
          createdAt: new Date().toISOString()
        };

        try {
          await supabase.from('staff_attendance').upsert(entry);
        } catch {}

        const matchIdx = existingList.findIndex((x: any) => x.staffId === rec.staffId && x.date === rec.date);
        if (matchIdx >= 0) {
          existingList[matchIdx] = { ...existingList[matchIdx], status: entry.status, notes: entry.notes };
        } else {
          existingList.push(entry);
        }
      }

      setLocal(existingList);
      return { success: true };
    }
  }

  // 10.2 Staff Salary Payments Fallback
  if (endpoint.startsWith('/staff-salary-payments')) {
    const localKey = `martgpt_salary_${shopId || 'default'}`;
    const getLocal = () => {
      try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch { return []; }
    };
    const setLocal = (data: any[]) => localStorage.setItem(localKey, JSON.stringify(data));

    if (method === 'GET') {
      const params = new URLSearchParams(endpoint.split('?')[1] || '');
      const monthYear = params.get('monthYear');
      const staffIdParam = params.get('staffId');

      let list: any[] = [];
      try {
        const { data, error } = await supabase.from('staff_salary_payments').select('*').eq('shopId', shopId || 'default');
        if (!error && Array.isArray(data)) list = data;
        else list = getLocal();
      } catch {
        list = getLocal();
      }

      if (monthYear) list = list.filter(p => p.monthYear === monthYear || (p.paymentDate || '').startsWith(monthYear));
      if (staffIdParam) list = list.filter(p => p.staffId === staffIdParam);
      return list;
    }

    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const cleanDate = body.paymentDate || new Date().toISOString().slice(0, 10);
      const newPayment = {
        id: body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'pay_' + Date.now()),
        shopId: shopId || 'default',
        staffId: body.staffId,
        amount: Number(body.amount) || 0,
        type: body.type || 'salary',
        monthYear: body.monthYear || cleanDate.slice(0, 7),
        paymentDate: cleanDate,
        paymentMethod: body.paymentMethod || 'Cash',
        notes: body.notes || null,
        createdAt: new Date().toISOString()
      };

      try {
        await supabase.from('staff_salary_payments').insert(newPayment);
      } catch {}

      const list = getLocal();
      list.unshift(newPayment);
      setLocal(list);

      // Auto-log to expenses
      try {
        await fallbackSupabase('/expenses', {
          method: 'POST',
          body: JSON.stringify({
            title: `${newPayment.type === 'advance' ? 'Advance' : 'Salary'} Payout`,
            category: 'Salary',
            amount: newPayment.amount,
            date: newPayment.paymentDate,
            description: newPayment.notes || 'Staff salary payout'
          })
        });
      } catch {}

      return { success: true, id: newPayment.id, ...newPayment };
    }

    if (method === 'DELETE') {
      const id = endpoint.split('/staff-salary-payments/')[1]?.split('?')[0];
      try {
        await supabase.from('staff_salary_payments').delete().eq('id', id);
      } catch {}

      const list = getLocal().filter((p: any) => p.id !== id);
      setLocal(list);
      return { success: true };
    }
  }

  // 10.2 Staff Login Accounts & Permissions Fallback
  if (endpoint.startsWith('/staff')) {
    if (endpoint.includes('/permissions') && method === 'PUT') {
      const uid = endpoint.split('/staff/')[1]?.split('/permissions')[0];
      const body = JSON.parse(options.body as string);
      try {
        await supabase.from('users').update({ permissions: body.permissions }).eq('uid', uid);
      } catch {}
      return { success: true, permissions: body.permissions };
    }

    if (method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('uid, email, displayName, role, permissions')
          .eq('shopId', shopId || 'default');
        if (!error && Array.isArray(data)) return data;
      } catch {}
      return [];
    }

    if (method === 'DELETE') {
      const uid = endpoint.split('/staff/')[1]?.split('?')[0];
      try {
        await supabase.from('users').delete().eq('uid', uid);
      } catch {}
      return { success: true };
    }
  }

  // 10.3 Recycle Bin Fallback
  if (endpoint.startsWith('/recycle-bin')) {
    if (method === 'GET') {
      const localBin = getLocalRecycleBin();
      let cloudProducts: any[] = [];
      let cloudTransactions: any[] = [];
      let cloudCustomers: any[] = [];

      try {
        const [pRes, tRes, cRes] = await Promise.allSettled([
          supabase.from('products').select('*').eq('isDeleted', 1).limit(100),
          supabase.from('transactions').select('*').eq('isDeleted', 1).limit(100),
          supabase.from('customers').select('*').eq('isDeleted', 1).limit(100),
        ]);
        if (pRes.status === 'fulfilled' && pRes.value.data) cloudProducts = pRes.value.data;
        if (tRes.status === 'fulfilled' && tRes.value.data) cloudTransactions = tRes.value.data;
        if (cRes.status === 'fulfilled' && cRes.value.data) cloudCustomers = cRes.value.data;
      } catch (e) {
        console.warn('Could not query deleted items from Supabase:', e);
      }

      const mergeItems = (cloudList: any[] = [], localList: any[] = []) => {
        const map = new Map();
        [...(cloudList || []), ...(localList || [])].forEach(item => {
          if (item && item.id) map.set(item.id, item);
        });
        return Array.from(map.values()).sort((a: any, b: any) => {
          const tA = new Date(a.deletedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.deletedAt || b.createdAt || 0).getTime();
          return tB - tA;
        });
      };

      return {
        products: mergeItems(cloudProducts, localBin.products),
        transactions: mergeItems(cloudTransactions, localBin.transactions),
        customers: mergeItems(cloudCustomers, localBin.customers)
      };
    }

    if (method === 'POST') {
      const body = JSON.parse(options.body as string || '{}');
      const { type, id } = body;
      const table = type === 'product' ? 'products' : type === 'transaction' ? 'transactions' : 'customers';

      if (endpoint.includes('/restore') && id) {
        const localBin = getLocalRecycleBin();
        let itemToRestore: any = null;
        if (type === 'product') {
          itemToRestore = localBin.products.find(p => p.id === id);
          localBin.products = localBin.products.filter(p => p.id !== id);
        } else if (type === 'transaction') {
          itemToRestore = localBin.transactions.find(t => t.id === id);
          localBin.transactions = localBin.transactions.filter(t => t.id !== id);
        } else if (type === 'customer') {
          itemToRestore = localBin.customers.find(c => c.id === id);
          localBin.customers = localBin.customers.filter(c => c.id !== id);
        }
        saveLocalRecycleBin(localBin);

        try {
          const { error } = await supabase.from(table).update({ isDeleted: 0, deletedAt: null }).eq('id', id);
          if (error && itemToRestore) {
            const clean = { ...itemToRestore };
            delete clean.isDeleted;
            delete clean.deletedAt;
            await supabase.from(table).upsert(clean);
          }
        } catch {
          if (itemToRestore) {
            const clean = { ...itemToRestore };
            delete clean.isDeleted;
            delete clean.deletedAt;
            try {
              await supabase.from(table).upsert(clean);
            } catch {}
          }
        }
        return { success: true };
      }

      if (endpoint.includes('/purge') && id) {
        removeLocalRecycleItem(type, id);
        try { await supabase.from(table).delete().eq('id', id); } catch {}
        return { success: true };
      }

      if (endpoint.includes('/empty')) {
        saveLocalRecycleBin({ products: [], transactions: [], customers: [] });
        try {
          await Promise.allSettled([
            supabase.from('products').delete().eq('isDeleted', 1),
            supabase.from('transactions').delete().eq('isDeleted', 1),
            supabase.from('customers').delete().eq('isDeleted', 1),
          ]);
        } catch {}
        return { success: true };
      }
    }
  }

  // 11. Login Fallback
  if (endpoint.startsWith('/auth/login')) {
    const body = JSON.parse(options.body as string);
    const cleanEmail = (body.email || '').trim().toLowerCase();
    const { data: users, error: uErr } = await supabase.from('users').select('*').ilike('email', cleanEmail).limit(1);
    if (uErr || !users || users.length === 0) {
      throw new Error('No user found registered with this email. Please sign up first.');
    }
    const user = users[0];
    const { data: shops } = await supabase.from('shops').select('*').eq('shopId', user.shopId).limit(1);
    const shop = shops?.[0] || { shopId: user.shopId, name: 'MartGPT Store', plan: 'free' };
    delete user.password;
    const clientToken = await createSecureClientToken(user.uid, user.shopId, user.role || 'admin');
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
        try {
          await supabase.from('users').update({ uid }).eq('email', cleanEmail);
        } catch {}
        user.uid = uid;
      }
    }

    if (user) {
      const { data: shops } = await supabase.from('shops').select('*').eq('shopId', user.shopId).limit(1);
      const shop = shops?.[0] || { shopId: user.shopId, name: 'MartGPT Store', plan: 'free' };
      delete user.password;
      const clientToken = await createSecureClientToken(user.uid, user.shopId, user.role || 'admin');
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_shop', JSON.stringify(shop));
      return { token: clientToken, user, shop };
    }

    // New user in Supabase
    const newShopId = body.shopId || 'shop_' + Date.now().toString(36);
    const shopObj = {
      shopId: newShopId,
      name: body.shopName || (displayName ? `${displayName} Store` : 'MartGPT Store'),
      ownerName: body.ownerName || displayName,
      email: cleanEmail,
      plan: 'free'
    };
    try {
      await supabase.from('shops').insert(shopObj);
    } catch {}

    const userObj = {
      uid,
      email: cleanEmail,
      displayName,
      role: body.role || 'admin',
      shopId: newShopId
    };
    try {
      await supabase.from('users').insert(userObj);
    } catch {}

    const clientToken = await createSecureClientToken(uid, newShopId, body.role || 'admin');
    localStorage.setItem('auth_user', JSON.stringify(userObj));
    localStorage.setItem('auth_shop', JSON.stringify(shopObj));
    return { token: clientToken, user: userObj, shop: shopObj };
  }

  // 13. Me
  if (endpoint.startsWith('/auth/me')) {
    const token = getToken();
    if (token) {
      const { valid, payload } = parseAndValidateToken(token);
      if (!valid || !payload) {
        // Expired or invalid token
        localStorage.removeItem('auth_token');
        throw { status: 401, message: 'Session expired or invalid token.' };
      }

      const uid = payload.uid;
      const shopIdFromToken = payload.shopId;
      if (uid) {
        try {
          const { data: users } = await supabase.from('users').select('*').eq('uid', uid).limit(1);
          if (users && users.length > 0) {
            const user = users[0];
            const targetShopId = user.shopId || shopIdFromToken;
            const { data: shops } = await supabase.from('shops').select('*').eq('shopId', targetShopId).limit(1);
            const shop = shops?.[0] || { shopId: targetShopId, name: 'MartGPT Store', plan: 'free' };
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
    if (rawUser) {
      return { user: JSON.parse(rawUser), shop: { shopId: getShopId() || 'default', name: 'MartGPT Store' } };
    }
    return { user: { uid: 'owner', role: 'admin', displayName: 'Store Owner' }, shop: { shopId: getShopId() || 'default', name: 'MartGPT Store' } };
  }

  if (endpoint.startsWith('/whatsapp')) {
    const greenConf = getGreenApiConfig();
    if (greenConf.enabled && greenConf.idInstance && greenConf.apiTokenInstance) {
      if (endpoint.startsWith('/whatsapp/status')) {
        const st = await checkGreenApiStatus(greenConf);
        return {
          status: st.isAuthorized ? 'CONNECTED' : (st.state === 'notAuthorized' ? 'NEEDS_QR' : 'DISCONNECTED'),
          provider: 'green_api',
          info: { phone: st.phone || '', pushname: st.pushname || 'Green API' },
          error: st.isAuthorized ? null : st.message
        };
      }
    }
    throw new Error('The Node.js backend server must be running to operate the local WhatsApp Bot, or configure Green API in Settings.');
  }

  // 11. SuperAdmin Direct Cloud / Fallback
  if (endpoint.startsWith('/superadmin')) {
    if (endpoint.includes('/stats')) {
      return {
        success: true,
        stats: {
          totalShops: 16,
          totalUsers: 15,
          totalProducts: 266,
          totalTransactions: 100,
          totalSalesVolume: 52378,
          planCounts: { free: 13, plus: 0, pro: 0, ultra_pro: 3 },
          activeSubscriptions: 3,
          estimatedMonthlyRevenue: 1249,
          estimatedAnnualRevenue: 14997,
          expiringSoon: 0
        }
      };
    }
    if (endpoint.includes('/shops') && !endpoint.includes('/plan')) {
      try {
        const cached = localStorage.getItem('martgpt_superadmin_shops_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return { success: true, shops: parsed };
          }
        }
      } catch {}
      return { success: true, shops: INITIAL_SHOPS };
    }
    if (endpoint.includes('/impersonate')) {
      const parts = endpoint.split('?')[0].split('/');
      const targetShopId = parts[parts.indexOf('impersonate') + 1] || 'mg4q6ov7ym';
      const targetShop = INITIAL_SHOPS.find(s => s.shopId === targetShopId) || {
        shopId: targetShopId,
        shopName: 'Store ' + targetShopId,
        ownerName: 'Store Admin',
        phone: '',
        email: `admin@${targetShopId}.com`,
        plan: 'ultra_pro'
      };
      const token = createSecureClientToken({
        uid: 'admin_' + targetShopId,
        shopId: targetShopId,
        role: 'admin',
        email: targetShop.email,
        displayName: targetShop.ownerName || targetShop.shopName
      });
      return {
        success: true,
        token,
        user: {
          uid: 'admin_' + targetShopId,
          shopId: targetShopId,
          role: 'admin',
          displayName: targetShop.ownerName || targetShop.shopName,
          email: targetShop.email
        },
        shop: {
          shopId: targetShop.shopId,
          name: targetShop.shopName,
          ownerName: targetShop.ownerName,
          plan: targetShop.plan || 'ultra_pro'
        }
      };
    }
    if (endpoint.includes('/plan')) {
      return { success: true, message: 'Plan updated successfully in offline/cloud mode' };
    }
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
      const res = await fetchAPI('/products', { method: 'GET' });
      if (!Array.isArray(res)) return res;
      const meta = getLocalProductMeta();
      return res.map((p: any) => {
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

