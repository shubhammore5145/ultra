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
    localStorage.setItem(RECYCLE_BIN_STORAGE_KEY, JSON.stringify(data));
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
      const localBin = getLocalRecycleBin();
      const deletedIds = new Set(localBin.products.map(p => p.id));
      const activeProducts = (data || []).filter((p: any) => !p.isDeleted && !deletedIds.has(p.id));
      return activeProducts;
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
            await supabase.from(table).upsert(clean).catch(() => {});
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
      const shop = shops?.[0] || { shopId: user.shopId, name: 'MartGPT Store', plan: 'free' };
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
      name: body.shopName || (displayName ? `${displayName} Store` : 'MartGPT Store'),
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
      let shopIdFromToken: string | null = null;
      if (token.startsWith('sb_')) {
        try {
          const payload = JSON.parse(atob(token.slice(3)));
          uid = payload.uid;
          shopIdFromToken = payload.shopId;
        } catch (e) {}
      } else {
        // Standard JWT token payload decoder
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            uid = payload.uid;
            shopIdFromToken = payload.shopId;
          }
        } catch (e) {}
      }
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
    throw new Error('The Node.js backend server must be running to operate the WhatsApp Bot. Please start the local server or cloud web service.');
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
    list: () => fetchAPI('/products', { method: 'GET' }),
    create: (data: any) => fetchAPI('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchAPI(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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

