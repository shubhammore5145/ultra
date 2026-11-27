/**
 * IndexedDB Storage Engine for MartGPT / Nayashi Kirana
 * 
 * Replaces fragile 5MB localStorage limits with high-capacity (up to several GB)
 * IndexedDB client storage. Includes:
 * - Async key-value API (get, set, del, keys, clear)
 * - Automatic localStorage fallback if IndexedDB is blocked
 * - Auto-pruning for receipts older than 30 days
 * - Dedicated helpers for Product catalog, Receipts, and Offline Sync Queue
 */

const DB_NAME = 'martgpt_storage_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

// IndexedDB Connection Singleton
let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.warn('IndexedDB open error, falling back to localStorage:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Get value by key from IndexedDB with fallback to localStorage
 */
export async function idbGet<T = any>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        if (req.result !== undefined) {
          resolve(req.result as T);
        } else {
          // Check localStorage as fallback
          try {
            const raw = localStorage.getItem(key);
            resolve(raw ? JSON.parse(raw) : null);
          } catch {
            resolve(null);
          }
        }
      };

      req.onerror = () => {
        try {
          const raw = localStorage.getItem(key);
          resolve(raw ? JSON.parse(raw) : null);
        } catch {
          resolve(null);
        }
      };
    });
  } catch {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Set value by key into IndexedDB with dual-write to localStorage for small critical items
 */
export async function idbSet<T = any>(key: string, value: T): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // If IndexedDB fails, fallback to localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (lsErr) {
      console.warn('Both IndexedDB and localStorage write failed:', lsErr);
    }
  }
}

/**
 * Delete key from IndexedDB and localStorage
 */
export async function idbDel(key: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}

  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Get all keys in storage
 */
export async function idbKeys(): Promise<string[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();

      req.onsuccess = () => {
        resolve((req.result as string[]) || []);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return Object.keys(localStorage);
  }
}

/**
 * Clear all storage
 */
export async function idbClear(): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN SPECIFIC CACHE & PRUNE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Auto-prune receipts older than keepDays (default: 30 days)
 * Prevents offline client disk clutter while keeping recent bills instant
 */
export async function pruneOldReceipts(keepDays = 30): Promise<number> {
  try {
    const keys = await idbKeys();
    const receiptKeys = keys.filter(k => k.startsWith('receipt_'));
    const cutoff = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const key of receiptKeys) {
      try {
        const item = await idbGet<any>(key);
        if (item && item.createdAt) {
          const itemTime = new Date(item.createdAt).getTime();
          if (!isNaN(itemTime) && itemTime < cutoff) {
            await idbDel(key);
            deletedCount++;
          }
        }
      } catch {}
    }

    // Also clean up any stale receipt_ keys in localStorage
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('receipt_')) {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.createdAt) {
                const itemTime = new Date(parsed.createdAt).getTime();
                if (!isNaN(itemTime) && itemTime < cutoff) {
                  localStorage.removeItem(k);
                }
              }
            }
          } catch {}
        }
      }
    } catch {}

    return deletedCount;
  } catch {
    return 0;
  }
}

/**
 * Save full digital receipt to offline storage
 */
export async function saveReceiptOffline(txId: string, receiptData: any): Promise<void> {
  const fullKey = `receipt_${txId}`;
  const shortKey = `receipt_${txId.slice(0, 8)}`;

  // Save to IndexedDB (virtually unlimited capacity)
  await Promise.all([
    idbSet(fullKey, receiptData),
    idbSet(shortKey, receiptData)
  ]);

  // Safe dual-write to localStorage for instant sync components (wrapped in try-catch to avoid quota errors)
  try {
    localStorage.setItem(fullKey, JSON.stringify(receiptData));
    localStorage.setItem(shortKey, JSON.stringify(receiptData));
  } catch {
    // If localStorage quota is exceeded, prune old receipts automatically
    pruneOldReceipts(15).catch(() => {});
  }
}

/**
 * Retrieve digital receipt from offline storage (checks IDB first, then localStorage)
 */
export async function getReceiptOffline(cleanId: string): Promise<any | null> {
  const fullKey = `receipt_${cleanId}`;
  const shortKey = `receipt_${cleanId.slice(0, 8)}`;

  // 1. Try IndexedDB
  let item = await idbGet<any>(fullKey);
  if (item) return item;

  item = await idbGet<any>(shortKey);
  if (item) return item;

  // 2. Try localStorage
  try {
    const raw = localStorage.getItem(fullKey) || localStorage.getItem(shortKey);
    if (raw) return JSON.parse(raw);
  } catch {}

  return null;
}

/**
 * Save large product catalog into IndexedDB
 */
export async function cacheProductsOffline(products: any[]): Promise<void> {
  await idbSet('pos_products_cache', products);
  try {
    // If product list is small (< 500 items), dual write for synchronous init
    if (products.length <= 500) {
      localStorage.setItem('pos_products_cache', JSON.stringify(products));
    }
  } catch {
    // Quota reached in localStorage, but IndexedDB safely holds all products!
  }
}

/**
 * Read cached products (synchronous localStorage check + async IndexedDB load)
 */
export async function getCachedProductsOffline(): Promise<any[]> {
  const fromIdb = await idbGet<any[]>('pos_products_cache');
  if (Array.isArray(fromIdb) && fromIdb.length > 0) {
    return fromIdb;
  }

  try {
    const raw = localStorage.getItem('pos_products_cache');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
