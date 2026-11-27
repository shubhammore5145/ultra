import { useState, useEffect, useMemo, useRef } from 'react';
import { api, invalidateProductsCache } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { CameraScanner } from '../components/CameraScanner';
import { runInvoiceOcrPipeline, type ParsedInvoiceItem } from '../lib/invoiceOcrEngine';
import { findFMCGByBarcode } from '../lib/fmcgCatalog';
import { 
  Package, Search, AlertTriangle, Loader2, Save, 
  Trash2, CheckCircle2, History,
  TrendingDown, Sparkles, Plus, X, 
  Camera, Upload, BrainCircuit, ScanBarcode
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import type { Product, DamagedItem, StockMovement, Transaction } from '../types';

interface AiScanRow extends ParsedInvoiceItem {
  selected: boolean;
  existingStock: number;
}

export default function Inventory() {
  const { shopData } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Transaction[]>([]);
  const [damagedItems, setDamagedItems] = useState<DamagedItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'stock' | 'ai_scan' | 'expiry' | 'audit' | 'damaged' | 'deadstock' | 'movements'>('stock');

  // Inline Stock Edits
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});
  const [rackEdits, setRackEdits] = useState<Record<string, string>>({});

  // AI Scan States (Barcode Live Scan + OCR Photo Scan)
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraScanTarget, setCameraScanTarget] = useState<'ai_tab' | 'stock_search'>('ai_tab');
  const [aiBarcodeInput, setAiBarcodeInput] = useState('');
  const [autoIncrementOnScan, setAutoIncrementOnScan] = useState(false);
  const [scannedExistingProduct, setScannedExistingProduct] = useState<Product | null>(null);
  const [quickRestockAddQty, setQuickRestockAddQty] = useState('1');
  const [quickRestockRack, setQuickRestockRack] = useState('');
  const [quickRestockExpiry, setQuickRestockExpiry] = useState('');
  const [quickNewBarcode, setQuickNewBarcode] = useState('');
  const [quickNewProductForm, setQuickNewProductForm] = useState({
    name: '',
    category: 'Grocery',
    brand: '',
    unit: 'pcs',
    purchasePrice: '',
    sellingPrice: '',
    mrp: '',
    stock: '10',
    minStock: '5',
    rackLocation: ''
  });
  const [aiOcrLoading, setAiOcrLoading] = useState(false);
  const [aiOcrProgress, setAiOcrProgress] = useState(0);
  const [aiOcrStatusText, setAiOcrStatusText] = useState('');
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null);
  const [aiExtractedRows, setAiExtractedRows] = useState<AiScanRow[]>([]);
  const [aiBannerMessage, setAiBannerMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // Damaged Goods Form Modal
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [selectedDamageProduct, setSelectedDamageProduct] = useState<Product | null>(null);
  const [damageQty, setDamageQty] = useState('1');
  const [damageReason, setDamageReason] = useState<'broken' | 'leaked' | 'expired' | 'rodent_pest' | 'packaging_torn' | 'other'>('broken');
  const [damageNotes, setDamageNotes] = useState('');

  // Physical Audit Counts
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [auditNotes, setAuditNotes] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, txList, dmgList, movList] = await Promise.all([
        api.products.list(),
        api.transactions.list(),
        api.damagedGoods.list(),
        api.stockMovements.list()
      ]);
      setProducts(Array.isArray(prods) ? prods : []);
      setSales(Array.isArray(txList) ? txList : []);
      setDamagedItems(Array.isArray(dmgList) ? dmgList : []);
      setStockMovements(Array.isArray(movList) ? movList : []);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopData?.shopId]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Valuation Metrics
  const metrics = useMemo(() => {
    let totalStockPieces = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach(p => {
      const s = Number(p.stock || 0);
      const cp = Number(p.purchasePrice || 0);
      const sp = Number(p.sellingPrice || 0);
      const minS = Number(p.minStock || 5);

      totalStockPieces += s;
      totalCostValuation += s * cp;
      totalRetailValuation += s * sp;

      if (!p.isLoose && s <= 0) outOfStockCount++;
      else if (!p.isLoose && s <= minS) lowStockCount++;
    });

    const potentialProfit = totalRetailValuation - totalCostValuation;

    return {
      totalProducts: products.length,
      totalStockPieces,
      totalCostValuation,
      totalRetailValuation,
      potentialProfit,
      lowStockCount,
      outOfStockCount
    };
  }, [products]);

  // Expiry Analysis
  const expiryAnalysis = useMemo(() => {
    const today = new Date();
    const sevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expired: Product[] = [];
    const expiringSoon7: Product[] = [];
    const expiringSoon30: Product[] = [];

    products.forEach(p => {
      if (!p.expiryDate) return;
      const exp = new Date(p.expiryDate);
      if (isNaN(exp.getTime())) return;

      if (exp < today) {
        expired.push(p);
      } else if (exp <= sevenDays) {
        expiringSoon7.push(p);
      } else if (exp <= thirtyDays) {
        expiringSoon30.push(p);
      }
    });

    return { expired, expiringSoon7, expiringSoon30 };
  }, [products]);

  // Fast, Slow & Dead Stock Analytics
  const stockMovementAnalysis = useMemo(() => {
    const salesMap = new Map<string, number>();
    sales.forEach(tx => {
      (tx.items || []).forEach(it => {
        const prev = salesMap.get(it.id) || 0;
        salesMap.set(it.id, prev + Number(it.qty || 1));
      });
    });

    const fastMoving: { product: Product; unitsSold: number }[] = [];
    const slowMoving: { product: Product; unitsSold: number }[] = [];
    const deadStock: { product: Product; blockedCapital: number }[] = [];

    products.forEach(p => {
      const sold = salesMap.get(p.id) || 0;
      const stock = Number(p.stock || 0);

      if (sold >= 15) {
        fastMoving.push({ product: p, unitsSold: sold });
      } else if (sold > 0) {
        slowMoving.push({ product: p, unitsSold: sold });
      } else if (stock > 0) {
        deadStock.push({ product: p, blockedCapital: stock * Number(p.purchasePrice || 0) });
      }
    });

    fastMoving.sort((a, b) => b.unitsSold - a.unitsSold);
    deadStock.sort((a, b) => b.blockedCapital - a.blockedCapital);

    const totalDeadStockCapital = deadStock.reduce((s, it) => s + it.blockedCapital, 0);

    return { fastMoving, slowMoving, deadStock, totalDeadStockCapital };
  }, [products, sales]);

  // Filtered products for Tab 1 (Stock Hub)
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const mName = p.name?.toLowerCase().includes(q);
        const mBar = p.barcode?.toLowerCase().includes(q);
        const mRack = p.rackLocation?.toLowerCase().includes(q);
        return mName || mBar || mRack;
      }
      return true;
    });
  }, [products, categoryFilter, searchTerm]);

  // Handle Inline Stock or Rack Change
  const handleStockChange = (productId: string, val: string) => {
    const num = parseInt(val, 10);
    setStockEdits(prev => ({ ...prev, [productId]: isNaN(num) ? 0 : num }));
  };

  const handleRackChange = (productId: string, val: string) => {
    setRackEdits(prev => ({ ...prev, [productId]: val }));
  };

  // AI Smart Reorder Recommendations (low stock or fast-moving items running low)
  const aiReorderSuggestions = useMemo(() => {
    const salesMap = new Map<string, number>();
    sales.forEach(tx => {
      (tx.items || []).forEach(it => {
        salesMap.set(it.id, (salesMap.get(it.id) || 0) + Number(it.qty || 1));
      });
    });

    return products
      .filter(p => !p.isLoose && Number(p.stock || 0) <= Number(p.minStock || 5))
      .map(p => {
        const sold30d = salesMap.get(p.id) || 0;
        const minThreshold = Number(p.minStock || 5);
        const currentStock = Number(p.stock || 0);
        const suggestedQty = Math.max(minThreshold * 2 - currentStock, Math.ceil(sold30d / 2), 5);
        return {
          product: p,
          sold30d,
          suggestedQty,
          estimatedCost: suggestedQty * Number(p.purchasePrice || 0)
        };
      })
      .sort((a, b) => a.product.stock - b.product.stock || b.sold30d - a.sold30d)
      .slice(0, 15);
  }, [products, sales]);

  // Handle Barcode / ShortCode Lookup in AI Scan
  const handleAiBarcodeLookup = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    setAiBannerMessage(null);

    const lower = code.toLowerCase();
    const matched = products.find(p =>
      (p.barcode && p.barcode.trim().toLowerCase() === lower) ||
      (p.sku && p.sku.trim().toLowerCase() === lower) ||
      (p.shortCode && String(p.shortCode).trim().toLowerCase() === lower) ||
      p.name.toLowerCase() === lower
    );

    if (matched) {
      setQuickNewBarcode('');
      if (autoIncrementOnScan) {
        try {
          const prevStock = Number(matched.stock || 0);
          const nextStock = prevStock + 1;
          await api.products.update(matched.id, { stock: nextStock });
          await api.stockMovements.log({
            id: crypto.randomUUID(),
            productId: matched.id,
            productName: matched.name,
            type: 'inward_purchase',
            qty: 1,
            previousStock: prevStock,
            newStock: nextStock,
            reason: 'AI Scan Continuous +1 Restock',
            createdAt: new Date().toISOString()
          });
          invalidateProductsCache();
          setAiBannerMessage({
            type: 'success',
            text: `Added +1 to "${matched.name}" (Stock: ${prevStock} -> ${nextStock})`
          });
          await loadData();
        } catch (err: any) {
          setAiBannerMessage({ type: 'error', text: 'Failed to update stock: ' + err.message });
        }
        return;
      }

      setScannedExistingProduct(matched);
      setQuickRestockAddQty('1');
      setQuickRestockRack(matched.rackLocation || '');
      setQuickRestockExpiry(matched.expiryDate || '');
      setAiBannerMessage({
        type: 'info',
        text: `Matched "${matched.name}" (Current Stock: ${matched.stock} ${matched.unit || 'pcs'})`
      });
    } else {
      setScannedExistingProduct(null);
      setQuickNewBarcode(code);
      const fmcgMatch = findFMCGByBarcode(code);
      if (fmcgMatch) {
        setQuickNewProductForm({
          name: fmcgMatch.name,
          category: fmcgMatch.category || 'Grocery',
          brand: fmcgMatch.brand || '',
          unit: fmcgMatch.unit || 'pcs',
          purchasePrice: String(fmcgMatch.purchasePrice || ''),
          sellingPrice: String(fmcgMatch.sellingPrice || ''),
          mrp: String(fmcgMatch.mrp || ''),
          stock: '10',
          minStock: '5',
          rackLocation: ''
        });
        setAiBannerMessage({
          type: 'success',
          text: `AI Catalog Auto-Matched "${fmcgMatch.name}" for barcode ${code}! Review & click Add Product.`
        });
      } else {
        setQuickNewProductForm({
          name: '',
          category: 'Grocery',
          brand: '',
          unit: 'pcs',
          purchasePrice: '',
          sellingPrice: '',
          mrp: '',
          stock: '10',
          minStock: '5',
          rackLocation: ''
        });
        setAiBannerMessage({
          type: 'info',
          text: `New barcode "${code}" not found in store. Fill details below to add it straight to inventory.`
        });
      }
    }
  };

  // Save quick restock for scanned existing product
  const handleSaveScannedRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedExistingProduct) return;
    const addQty = Number(quickRestockAddQty || 0);
    if (isNaN(addQty) || addQty < 0) {
      alert('Please enter a valid quantity to add.');
      return;
    }
    setSaving(true);
    try {
      const prevStock = Number(scannedExistingProduct.stock || 0);
      const nextStock = prevStock + addQty;
      await api.products.update(scannedExistingProduct.id, {
        stock: nextStock,
        rackLocation: quickRestockRack.trim() || scannedExistingProduct.rackLocation || undefined,
        expiryDate: quickRestockExpiry || scannedExistingProduct.expiryDate || undefined
      });
      if (addQty > 0) {
        await api.stockMovements.log({
          id: crypto.randomUUID(),
          productId: scannedExistingProduct.id,
          productName: scannedExistingProduct.name,
          type: 'inward_purchase',
          qty: addQty,
          previousStock: prevStock,
          newStock: nextStock,
          reason: 'AI Barcode Stock-In',
          createdAt: new Date().toISOString()
        });
      }
      invalidateProductsCache();
      setAiBannerMessage({
        type: 'success',
        text: `Updated "${scannedExistingProduct.name}": Stock ${prevStock} -> ${nextStock}`
      });
      setScannedExistingProduct(null);
      setAiBarcodeInput('');
      await loadData();
    } catch (err: any) {
      setAiBannerMessage({ type: 'error', text: err.message || 'Failed to save restock.' });
    } finally {
      setSaving(false);
    }
  };

  // Create new product from scanned barcode
  const handleCreateScannedProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNewProductForm.name.trim()) return;
    setSaving(true);
    try {
      const newId = crypto.randomUUID();
      const stockNum = Number(quickNewProductForm.stock || 0);
      await api.products.create({
        id: newId,
        name: quickNewProductForm.name.trim(),
        category: quickNewProductForm.category || 'Grocery',
        brand: quickNewProductForm.brand || '',
        unit: quickNewProductForm.unit || 'pcs',
        purchasePrice: Number(quickNewProductForm.purchasePrice || 0),
        sellingPrice: Number(quickNewProductForm.sellingPrice || 0),
        mrp: Number(quickNewProductForm.mrp || quickNewProductForm.sellingPrice || 0),
        gst: 0,
        stock: stockNum,
        minStock: Number(quickNewProductForm.minStock || 5),
        sku: quickNewBarcode,
        barcode: quickNewBarcode,
        rackLocation: quickNewProductForm.rackLocation || null,
        createdAt: new Date().toISOString()
      });
      await api.stockMovements.log({
        id: crypto.randomUUID(),
        productId: newId,
        productName: quickNewProductForm.name.trim(),
        type: 'inward_purchase',
        qty: stockNum,
        previousStock: 0,
        newStock: stockNum,
        reason: 'Added via AI Barcode Scan',
        createdAt: new Date().toISOString()
      });
      invalidateProductsCache();
      setAiBannerMessage({
        type: 'success',
        text: `Created "${quickNewProductForm.name.trim()}" in MongoDB Inventory with ${stockNum} units!`
      });
      setQuickNewBarcode('');
      setAiBarcodeInput('');
      await loadData();
    } catch (err: any) {
      setAiBannerMessage({ type: 'error', text: err.message || 'Failed to create product.' });
    } finally {
      setSaving(false);
    }
  };

  // Handle Photo / Bill Upload OCR Scan
  const handleAiPhotoUpload = async (file: File) => {
    if (!file) return;
    setAiOcrLoading(true);
    setAiOcrProgress(5);
    setAiOcrStatusText('Preparing image for AI neural OCR...');
    setAiBannerMessage(null);

    try {
      const readerUrl = URL.createObjectURL(file);
      setAiPreviewUrl(readerUrl);

      const result = await runInvoiceOcrPipeline(file, products, (pct, status) => {
        setAiOcrProgress(pct);
        setAiOcrStatusText(status);
      });

      const mappedRows: AiScanRow[] = (result.items || []).map(it => {
        const existing = it.matchedProductId
          ? products.find(p => p.id === it.matchedProductId)
          : products.find(p => p.name.trim().toLowerCase() === it.name.trim().toLowerCase());
        return {
          ...it,
          matchedProductId: existing?.id || it.matchedProductId || '',
          isNewProduct: !existing,
          existingStock: existing ? Number(existing.stock || 0) : 0,
          selected: true
        };
      });

      setAiExtractedRows(mappedRows);
      if (mappedRows.length === 0) {
        setAiBannerMessage({
          type: 'error',
          text: 'Could not detect clear product lines in this image. Try a sharper, well-lit photo of the bill or product list.'
        });
      } else {
        setAiBannerMessage({
          type: 'success',
          text: `AI extracted ${mappedRows.length} items! Review quantities below and click "Apply to Inventory".`
        });
      }
    } catch (err: any) {
      setAiBannerMessage({ type: 'error', text: 'AI OCR error: ' + (err.message || 'Failed to read image') });
    } finally {
      setAiOcrLoading(false);
    }
  };

  // Apply all checked OCR rows to Inventory
  const handleApplyAiRowsToInventory = async () => {
    const selected = aiExtractedRows.filter(r => r.selected);
    if (selected.length === 0) {
      alert('Please select at least one item to apply.');
      return;
    }
    setSaving(true);
    let updatedCount = 0;
    let createdCount = 0;

    try {
      for (const row of selected) {
        const addQty = Math.max(0, Number(row.qty || 0));
        const existing = row.matchedProductId ? products.find(p => p.id === row.matchedProductId) : null;

        if (existing) {
          const prevStock = Number(existing.stock || 0);
          const nextStock = prevStock + addQty;
          await api.products.update(existing.id, {
            stock: nextStock,
            ...(row.purchasePrice > 0 ? { purchasePrice: Number(row.purchasePrice) } : {}),
            ...(row.sellingPrice > 0 ? { sellingPrice: Number(row.sellingPrice) } : {}),
            ...(row.mrp > 0 ? { mrp: Number(row.mrp) } : {})
          });
          await api.stockMovements.log({
            id: crypto.randomUUID(),
            productId: existing.id,
            productName: existing.name,
            type: 'inward_purchase',
            qty: addQty,
            previousStock: prevStock,
            newStock: nextStock,
            reason: 'AI Photo Bill Scan Restock',
            createdAt: new Date().toISOString()
          });
          updatedCount++;
        } else {
          const newId = crypto.randomUUID();
          await api.products.create({
            id: newId,
            name: row.name.trim(),
            category: 'Grocery',
            brand: '',
            unit: row.unit || 'pcs',
            purchasePrice: Number(row.purchasePrice || 0),
            sellingPrice: Number(row.sellingPrice || row.mrp || 0),
            mrp: Number(row.mrp || row.sellingPrice || 0),
            gst: Number(row.gstPercent || 0),
            stock: addQty,
            minStock: 5,
            sku: row.hsn || '',
            barcode: '',
            createdAt: new Date().toISOString()
          });
          await api.stockMovements.log({
            id: crypto.randomUUID(),
            productId: newId,
            productName: row.name.trim(),
            type: 'inward_purchase',
            qty: addQty,
            previousStock: 0,
            newStock: addQty,
            reason: 'Created via AI Photo Scan',
            createdAt: new Date().toISOString()
          });
          createdCount++;
        }
      }

      invalidateProductsCache();
      setAiBannerMessage({
        type: 'success',
        text: `Applied to MongoDB Inventory: ${updatedCount} restocked, ${createdCount} new products created!`
      });
      setAiExtractedRows([]);
      setAiPreviewUrl(null);
      await loadData();
    } catch (err: any) {
      setAiBannerMessage({ type: 'error', text: 'Failed to apply AI scan batch: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  // Quick 1-click restock for AI suggestion row
  const handleQuickRestockSuggestion = async (product: Product, addQty: number) => {
    setSaving(true);
    try {
      const prevStock = Number(product.stock || 0);
      const nextStock = prevStock + addQty;
      await api.products.update(product.id, { stock: nextStock });
      await api.stockMovements.log({
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        type: 'inward_purchase',
        qty: addQty,
        previousStock: prevStock,
        newStock: nextStock,
        reason: 'AI Smart Reorder Restock',
        createdAt: new Date().toISOString()
      });
      invalidateProductsCache();
      setAiBannerMessage({
        type: 'success',
        text: `Restocked "${product.name}" +${addQty} (New Stock: ${nextStock})`
      });
      await loadData();
    } catch (err: any) {
      setAiBannerMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Save all inline adjustments
  const saveAllEdits = async () => {
    setSaving(true);
    try {
      const ids = Array.from(new Set([...Object.keys(stockEdits), ...Object.keys(rackEdits)]));
      const promises = ids.map(async id => {
        const prod = products.find(p => p.id === id);
        if (!prod) return;
        const newStock = stockEdits[id] !== undefined ? stockEdits[id] : prod.stock;
        const newRack = rackEdits[id] !== undefined ? rackEdits[id] : prod.rackLocation;

        if (stockEdits[id] !== undefined && stockEdits[id] !== prod.stock) {
          await api.stockMovements.log({
            id: crypto.randomUUID(),
            productId: prod.id,
            productName: prod.name,
            type: 'audit_adjustment',
            qty: Math.abs(newStock - prod.stock),
            previousStock: prod.stock,
            newStock: newStock,
            reason: 'Manual Stock Adjustment',
            createdAt: new Date().toISOString()
          });
        }

        await api.products.update(id, {
          stock: newStock,
          rackLocation: newRack
        });
      });

      await Promise.all(promises);
      alert('Stock details updated successfully! ✅');
      setStockEdits({});
      setRackEdits({});
      await loadData();
    } catch (err: any) {
      alert('Failed to save stock edits: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // Record Damaged Goods
  const handleRecordDamaged = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDamageProduct) return;
    const qty = parseInt(damageQty, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid damaged quantity.');
      return;
    }

    const cp = Number(selectedDamageProduct.purchasePrice || 0);
    const totalLoss = qty * cp;

    try {
      const dmgEntry: DamagedItem = {
        id: crypto.randomUUID(),
        productId: selectedDamageProduct.id,
        productName: selectedDamageProduct.name,
        qty,
        costPrice: cp,
        totalLoss,
        reason: damageReason,
        notes: damageNotes,
        createdAt: new Date().toISOString()
      };

      await api.damagedGoods.create(dmgEntry);

      // Deduct from stock
      const newStock = Math.max(0, Number(selectedDamageProduct.stock || 0) - qty);
      await api.products.update(selectedDamageProduct.id, { stock: newStock });

      // Log movement
      await api.stockMovements.log({
        id: crypto.randomUUID(),
        productId: selectedDamageProduct.id,
        productName: selectedDamageProduct.name,
        type: damageReason === 'expired' ? 'expired_loss' : 'damaged_loss',
        qty,
        previousStock: selectedDamageProduct.stock,
        newStock,
        reason: `Damaged Stock write-off: ${damageReason}`,
        createdAt: new Date().toISOString()
      });

      alert(`✅ Recorded ${qty} damaged units of ${selectedDamageProduct.name}. Loss: ₹${totalLoss.toFixed(2)}`);
      setShowDamageModal(false);
      setSelectedDamageProduct(null);
      setDamageQty('1');
      setDamageNotes('');
      await loadData();
    } catch (err: any) {
      alert('Error writing off damaged goods: ' + err.message);
    }
  };

  // 1-Click Physical Audit Reconciliation
  const handleReconcileAudit = async () => {
    const toReconcile = Object.keys(auditCounts);
    if (toReconcile.length === 0) {
      alert('Please enter at least one counted quantity.');
      return;
    }

    if (!window.confirm(`Reconcile stock for ${toReconcile.length} items and adjust inventory counts?`)) {
      return;
    }

    setSaving(true);
    try {
      for (const id of toReconcile) {
        const prod = products.find(p => p.id === id);
        if (!prod) continue;
        const counted = auditCounts[id];
        if (counted === prod.stock) continue;

        await api.products.update(id, { stock: counted });
        await api.stockMovements.log({
          id: crypto.randomUUID(),
          productId: prod.id,
          productName: prod.name,
          type: 'audit_adjustment',
          qty: Math.abs(counted - prod.stock),
          previousStock: prod.stock,
          newStock: counted,
          reason: auditNotes || 'Physical Stock Audit Reconciliation',
          createdAt: new Date().toISOString()
        });
      }

      alert('Physical Stock Reconciliation completed successfully! ✅');
      setAuditCounts({});
      setAuditNotes('');
      await loadData();
    } catch (err: any) {
      alert('Reconciliation error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
              Advanced Inventory & Warehouse Hub
            </h1>
            <p className="text-xs text-muted-foreground">
              Supermarket-grade stock tracking, rack locations, damaged & expiry write-offs, physical stock reconciliation and dead stock analytics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {Object.keys(stockEdits).length > 0 || Object.keys(rackEdits).length > 0 ? (
            <Button
              onClick={saveAllEdits}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl shadow-md animate-pulse"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Changes ({Object.keys(stockEdits).length + Object.keys(rackEdits).length})
            </Button>
          ) : null}

          <Button
            size="sm"
            onClick={() => setActiveTab('ai_scan')}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs h-9 rounded-xl shadow-sm"
          >
            <Sparkles className="h-4 w-4 mr-1.5" /> AI Scan
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDamageModal(true)}
            className="text-xs font-bold h-9 rounded-xl border-rose-300 text-rose-600 dark:border-rose-800 hover:bg-rose-50"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5" /> Report Damaged Stock
          </Button>
        </div>
      </div>

      {/* D-Mart Inventory Valuation Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Total Stock Value (Cost)</span>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">At Cost</span>
          </div>
          <p className="text-2xl font-black text-foreground mt-2">
            ₹{metrics.totalCostValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {metrics.totalStockPieces.toLocaleString()} Total Units In-Stock (Pcs/Kg)
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Retail Valuation</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md">At Retail</span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            ₹{metrics.totalRetailValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Expected Profit: ₹{metrics.potentialProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Low / Out of Stock</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-amber-600">{metrics.lowStockCount}</span>
            <span className="text-xs font-bold text-rose-600">({metrics.outOfStockCount} zero stock)</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Requires Reordering</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Dead Stock Capital</span>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            ₹{stockMovementAnalysis.totalDeadStockCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{stockMovementAnalysis.deadStock.length} items without sales</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide border-b border-border/70 text-xs font-bold">
        {[
          { id: 'stock', label: '📦 Real-Time Stock Hub', count: filteredProducts.length },
          { id: 'ai_scan', label: '✨ AI Scan & Restock', count: aiReorderSuggestions.length },
          { id: 'expiry', label: '⏳ Expiry Management', count: expiryAnalysis.expired.length + expiryAnalysis.expiringSoon7.length },
          { id: 'audit', label: '📋 Physical Stock Reconciliation', count: products.length },
          { id: 'damaged', label: '⚠️ Damaged & Write-Off', count: damagedItems.length },
          { id: 'deadstock', label: '🛑 Dead & Slow Stock', count: stockMovementAnalysis.deadStock.length },
          { id: 'movements', label: '🔄 Stock Audit Trail', count: stockMovements.length }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-t-xl transition-all whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === tab.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: Stock Hub & Rack Location */}
      {activeTab === 'stock' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-card p-3 rounded-2xl border border-border/80">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search product name, barcode or rack (e.g. Rack A-1)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-xs sm:text-sm bg-background rounded-xl"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-input bg-background text-xs font-semibold flex-1 sm:flex-none"
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCameraScanTarget('stock_search');
                  setShowCameraScanner(true);
                }}
                className="h-10 px-3 rounded-xl text-xs font-bold border-indigo-300 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 shrink-0"
              >
                <Camera className="h-4 w-4" /> Scan
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-black border-b">
                  <tr>
                    <th className="px-3.5 py-3">Product Name</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Rack / Shelf 📍</th>
                    <th className="px-3 py-3 text-right">Cost Price</th>
                    <th className="px-3 py-3 text-right">Selling Price</th>
                    <th className="px-3 py-3 text-center">In-Stock</th>
                    <th className="px-3 py-3 text-center">Min Threshold</th>
                    <th className="px-3 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredProducts.map(p => {
                    const isEdited = stockEdits[p.id] !== undefined;
                    const isRackEdited = rackEdits[p.id] !== undefined;
                    const currentStock = isEdited ? stockEdits[p.id] : p.stock;
                    const currentRack = isRackEdited ? rackEdits[p.id] : (p.rackLocation || '');
                    const isOut = !p.isLoose && currentStock <= 0;
                    const isLow = !p.isLoose && !isOut && currentStock <= (p.minStock || 5);

                    return (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-3.5 py-3 font-bold text-foreground">
                          <p>{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono font-normal">
                            {p.barcode ? `Barcode: ${p.barcode}` : p.sku ? `SKU: ${p.sku}` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{p.category || 'General'}</td>
                        <td className="px-3 py-3">
                          <Input
                            placeholder="e.g. Rack A-1"
                            value={currentRack}
                            onChange={e => handleRackChange(p.id, e.target.value)}
                            className="h-7 w-28 text-xs bg-background rounded-lg font-mono"
                          />
                        </td>
                        <td className="px-3 py-3 text-right font-medium">₹{Number(p.purchasePrice || 0).toFixed(0)}</td>
                        <td className="px-3 py-3 text-right font-bold text-primary">₹{Number(p.sellingPrice || 0).toFixed(0)}</td>
                        <td className="px-3 py-3 text-center">
                          <Input
                            type="number"
                            value={currentStock}
                            onChange={e => handleStockChange(p.id, e.target.value)}
                            className={`h-8 w-20 mx-auto text-center font-black text-xs rounded-lg ${
                              isEdited ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'bg-background'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-3 text-center text-muted-foreground font-semibold">
                          {p.minStock || 5} {p.unit || 'pcs'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {isOut ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950">
                              Out of Stock (0)
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950">
                              Low Stock ({currentStock})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950">
                              In Stock ({currentStock})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1.5: AI Scan & Smart Restock */}
      {activeTab === 'ai_scan' && (
        <div className="space-y-5">
          {aiBannerMessage && (
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
              aiBannerMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : aiBannerMessage.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-indigo-50 border-indigo-300 text-indigo-800'
            }`}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>{aiBannerMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiBannerMessage(null)}
                className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Mode 1: Live Barcode / Camera AI Stock-In */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                    <ScanBarcode className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-foreground">Live Barcode &amp; Camera Stock-In</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Scan any product packet to restock existing items or auto-add new FMCG products.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold bg-muted/60 px-2.5 py-1.5 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoIncrementOnScan}
                    onChange={e => setAutoIncrementOnScan(e.target.checked)}
                    className="rounded text-indigo-600 cursor-pointer"
                  />
                  <span>Auto +1</span>
                </label>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAiBarcodeLookup(aiBarcodeInput);
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Scan barcode or type code & press Enter..."
                    value={aiBarcodeInput}
                    onChange={e => setAiBarcodeInput(e.target.value)}
                    className="pl-9 h-10 text-xs font-mono bg-background rounded-xl"
                  />
                </div>
                <Button type="submit" size="sm" className="h-10 px-4 rounded-xl font-bold text-xs">
                  Lookup
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setCameraScanTarget('ai_tab');
                    setShowCameraScanner(true);
                  }}
                  className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Camera className="h-4 w-4" /> Camera
                </Button>
              </form>

              {/* Matched Product Quick Restock Form */}
              {scannedExistingProduct && (
                <form onSubmit={handleSaveScannedRestock} className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-600 text-white">
                        Matched Store Product
                      </span>
                      <h4 className="font-black text-sm text-foreground mt-1">{scannedExistingProduct.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        Current Stock: <strong className="text-foreground">{scannedExistingProduct.stock} {scannedExistingProduct.unit || 'pcs'}</strong> • Selling: ₹{scannedExistingProduct.sellingPrice}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScannedExistingProduct(null)}
                      className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-muted-foreground mr-1">Quick Add:</span>
                    {[1, 5, 10, 24, 50].map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuickRestockAddQty(String(q))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                          quickRestockAddQty === String(q)
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-white text-foreground border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        +{q}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">Add Qty</label>
                      <Input
                        type="number"
                        min="0"
                        value={quickRestockAddQty}
                        onChange={e => setQuickRestockAddQty(e.target.value)}
                        className="h-9 text-xs font-black bg-white rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">Rack / Shelf</label>
                      <Input
                        placeholder="Rack A-1"
                        value={quickRestockRack}
                        onChange={e => setQuickRestockRack(e.target.value)}
                        className="h-9 text-xs bg-white rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">Expiry Date</label>
                      <Input
                        type="date"
                        value={quickRestockExpiry}
                        onChange={e => setQuickRestockExpiry(e.target.value)}
                        className="h-9 text-xs bg-white rounded-lg"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={saving} className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl">
                    {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                    Save Stock Update (New Total: {Number(scannedExistingProduct.stock || 0) + (Number(quickRestockAddQty) || 0)})
                  </Button>
                </form>
              )}

              {/* New Scanned Barcode Quick Add Form */}
              {quickNewBarcode && !scannedExistingProduct && (
                <form onSubmit={handleCreateScannedProduct} className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-300 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-600 text-white">
                        New Barcode: {quickNewBarcode}
                      </span>
                      <p className="text-xs font-bold text-foreground mt-1">Add directly to MongoDB Inventory</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuickNewBarcode('')}
                      className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Input
                        required
                        placeholder="Product Name (e.g. Parle-G 100g)"
                        value={quickNewProductForm.name}
                        onChange={e => setQuickNewProductForm(p => ({ ...p, name: e.target.value }))}
                        className="h-9 text-xs font-bold bg-white rounded-lg"
                      />
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Cost ₹"
                      value={quickNewProductForm.purchasePrice}
                      onChange={e => setQuickNewProductForm(p => ({ ...p, purchasePrice: e.target.value }))}
                      className="h-9 text-xs bg-white rounded-lg"
                    />
                    <Input
                      required
                      type="number"
                      step="0.01"
                      placeholder="Selling Price ₹ *"
                      value={quickNewProductForm.sellingPrice}
                      onChange={e => setQuickNewProductForm(p => ({ ...p, sellingPrice: e.target.value }))}
                      className="h-9 text-xs font-bold bg-white rounded-lg"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="MRP ₹"
                      value={quickNewProductForm.mrp}
                      onChange={e => setQuickNewProductForm(p => ({ ...p, mrp: e.target.value }))}
                      className="h-9 text-xs bg-white rounded-lg"
                    />
                    <Input
                      required
                      type="number"
                      placeholder="Opening Stock *"
                      value={quickNewProductForm.stock}
                      onChange={e => setQuickNewProductForm(p => ({ ...p, stock: e.target.value }))}
                      className="h-9 text-xs font-bold bg-white rounded-lg"
                    />
                  </div>

                  <Button type="submit" disabled={saving} className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl">
                    {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                    Create Product in Inventory
                  </Button>
                </form>
              )}
            </div>

            {/* Mode 2: AI Photo Bill / Parchi / Shelf OCR Scanner */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-foreground">AI Bill, Stock List &amp; Photo OCR Scan</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Upload a supplier invoice or handwritten stock list photo — AI extracts items &amp; quantities automatically.
                  </p>
                </div>
              </div>

              <input
                ref={aiFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAiPhotoUpload(f);
                  e.target.value = '';
                }}
              />

              <button
                type="button"
                disabled={aiOcrLoading}
                onClick={() => aiFileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/70 rounded-2xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                {aiOcrLoading ? (
                  <>
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    <p className="text-xs font-black text-indigo-700">{aiOcrStatusText} ({aiOcrProgress}%)</p>
                    <div className="w-full max-w-xs h-2 bg-indigo-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${aiOcrProgress}%` }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-11 w-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-black text-foreground">Click to Upload Bill / Invoice / Stock Sheet Photo</p>
                    <p className="text-[11px] text-muted-foreground">Supports JPG, PNG, WebP • Auto-matches existing items &amp; Indian FMCG catalog</p>
                  </>
                )}
              </button>

              {aiPreviewUrl && (
                <div className="flex items-center justify-between bg-muted/40 p-2.5 rounded-xl border text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={aiPreviewUrl} alt="Scanned invoice preview" className="h-10 w-10 rounded-lg object-cover border shrink-0" />
                    <span className="font-semibold text-muted-foreground truncate">Scanned photo processed by AI OCR</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setAiPreviewUrl(null); setAiExtractedRows([]); }}
                    className="h-7 text-[11px] text-rose-600"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Extracted AI Items Review Table */}
          {aiExtractedRows.length > 0 && (
            <div className="rounded-2xl border-2 border-indigo-400/50 bg-card overflow-hidden shadow-md">
              <div className="p-3.5 bg-indigo-50/70 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-black text-sm text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    AI Extracted Inventory Items ({aiExtractedRows.filter(r => r.selected).length} selected)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">Verify names, quantities, and rates before applying to MongoDB stock.</p>
                </div>
                <Button
                  onClick={handleApplyAiRowsToInventory}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl shadow-sm"
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                  Apply Selected to Inventory ({aiExtractedRows.filter(r => r.selected).length})
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/70 text-[10px] font-black uppercase border-b">
                    <tr>
                      <th className="px-3 py-2.5 text-center">Use</th>
                      <th className="px-3 py-2.5">Product Name &amp; Match</th>
                      <th className="px-3 py-2.5 text-center">Current Stock</th>
                      <th className="px-3 py-2.5 text-center">+ Add Qty</th>
                      <th className="px-3 py-2.5 text-right">Cost ₹</th>
                      <th className="px-3 py-2.5 text-right">Selling ₹</th>
                      <th className="px-3 py-2.5 text-center">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {aiExtractedRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={e => setAiExtractedRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: e.target.checked } : r))}
                            className="h-4 w-4 rounded text-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5 min-w-[200px]">
                          <Input
                            value={row.name}
                            onChange={e => setAiExtractedRows(prev => prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                            className="h-8 text-xs font-bold bg-background rounded-lg"
                          />
                          <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            row.matchedProductId ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {row.matchedProductId ? 'Matched Existing Product' : 'New Product Will Be Created'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-muted-foreground">
                          {row.existingStock}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Input
                            type="number"
                            min="0"
                            value={row.qty}
                            onChange={e => setAiExtractedRows(prev => prev.map((r, i) => i === idx ? { ...r, qty: Number(e.target.value) || 0 } : r))}
                            className="h-8 w-20 mx-auto text-center font-black text-xs bg-background rounded-lg"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.purchasePrice}
                            onChange={e => setAiExtractedRows(prev => prev.map((r, i) => i === idx ? { ...r, purchasePrice: Number(e.target.value) || 0 } : r))}
                            className="h-8 w-20 ml-auto text-right font-mono text-xs bg-background rounded-lg"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.sellingPrice}
                            onChange={e => setAiExtractedRows(prev => prev.map((r, i) => i === idx ? { ...r, sellingPrice: Number(e.target.value) || 0 } : r))}
                            className="h-8 w-20 ml-auto text-right font-mono font-bold text-xs bg-background rounded-lg"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => setAiExtractedRows(prev => prev.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mode 3: AI Smart Reorder Recommendations */}
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <div className="p-3.5 bg-muted/40 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="font-black text-xs text-foreground">AI Smart Reorder Predictions (Low &amp; Fast-Selling Items)</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-semibold">{aiReorderSuggestions.length} recommendations</span>
            </div>
            <div className="divide-y divide-border/60">
              {aiReorderSuggestions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  All products are well-stocked! No immediate restock needed.
                </div>
              ) : (
                aiReorderSuggestions.map(({ product, sold30d, suggestedQty, estimatedCost }) => (
                  <div key={product.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        In Stock: <strong className={product.stock <= 0 ? 'text-rose-600' : 'text-amber-600'}>{product.stock} {product.unit || 'pcs'}</strong> • 30d Sold: <strong>{sold30d}</strong> • Suggested Order: <strong className="text-primary">+{suggestedQty}</strong> (Est. ₹{estimatedCost.toFixed(0)})
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => handleQuickRestockSuggestion(product, 5)}
                        className="h-8 text-xs font-bold rounded-lg"
                      >
                        +5
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => handleQuickRestockSuggestion(product, 10)}
                        className="h-8 text-xs font-bold rounded-lg"
                      >
                        +10
                      </Button>
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() => handleQuickRestockSuggestion(product, suggestedQty)}
                        className="h-8 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        + {suggestedQty} Restock
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Expiry Management */}
      {activeTab === 'expiry' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-rose-300 bg-rose-50/70 dark:bg-rose-950/30 p-4">
              <p className="text-xs font-bold text-rose-800 dark:text-rose-300">🔴 Expired Stock</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{expiryAnalysis.expired.length} items</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Remove from shelves immediately</p>
            </div>
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-4">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">🟠 Expiring in 7 Days</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{expiryAnalysis.expiringSoon7.length} items</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Offer clearance discount</p>
            </div>
            <div className="rounded-2xl border border-yellow-300 bg-yellow-50/70 dark:bg-yellow-950/30 p-4">
              <p className="text-xs font-bold text-yellow-800 dark:text-yellow-300">🟡 Expiring in 30 Days</p>
              <p className="text-2xl font-black text-yellow-600 mt-1">{expiryAnalysis.expiringSoon30.length} items</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Move to front display racks</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
            <div className="p-3 bg-muted/40 font-bold text-xs border-b">
              Expiring Products List (Expiry Tracker)
            </div>
            <div className="divide-y divide-border/60">
              {[...expiryAnalysis.expired, ...expiryAnalysis.expiringSoon7, ...expiryAnalysis.expiringSoon30].length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  🎉 No items near expiration! All products are fresh and safe.
                </div>
              ) : (
                [...expiryAnalysis.expired, ...expiryAnalysis.expiringSoon7, ...expiryAnalysis.expiringSoon30].map(p => {
                  const expDate = p.expiryDate ? new Date(p.expiryDate) : null;
                  const isExpired = expDate ? expDate < new Date() : false;

                  return (
                    <div key={p.id} className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          In-Stock: <span className="font-bold text-foreground">{p.stock} {p.unit}</span> | Rack: {p.rackLocation || '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                          isExpired ? 'bg-rose-100 text-rose-700 dark:bg-rose-950' : 'bg-amber-100 text-amber-800 dark:bg-amber-950'
                        }`}>
                          {isExpired ? 'Expired' : `Expiry: ${p.expiryDate}`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Physical Stock Audit & Reconciliation */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-sm text-blue-950 dark:text-blue-100">
                Physical Stock Reconciliation (Audit)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter physical inventory counts. Inspect variance and adjust store stock levels in 1-click.
              </p>
            </div>
            {Object.keys(auditCounts).length > 0 && (
              <Button
                onClick={handleReconcileAudit}
                disabled={saving}
                className="bg-primary text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-md"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Save Reconciliation ({Object.keys(auditCounts).length} items)
              </Button>
            )}
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 uppercase text-[10px] font-black border-b">
                  <tr>
                    <th className="px-3.5 py-3">Product Name</th>
                    <th className="px-3 py-3 text-center">System Stock</th>
                    <th className="px-3 py-3 text-center">Physical Counted</th>
                    <th className="px-3 py-3 text-center">Variance</th>
                    <th className="px-3 py-3 text-right">Variance Value (Loss/Gain)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {products.map(p => {
                    const counted = auditCounts[p.id] !== undefined ? auditCounts[p.id] : p.stock;
                    const diff = counted - p.stock;
                    const lossGain = diff * Number(p.purchasePrice || 0);

                    return (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-3.5 py-3 font-bold text-foreground">
                          {p.name}
                          <span className="block text-[10px] text-muted-foreground font-normal">Rack: {p.rackLocation || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-foreground">{p.stock}</td>
                        <td className="px-3 py-3 text-center">
                          <Input
                            type="number"
                            value={counted}
                            onChange={e => {
                              const v = parseInt(e.target.value, 10);
                              setAuditCounts(prev => ({ ...prev, [p.id]: isNaN(v) ? 0 : v }));
                            }}
                            className={`h-8 w-24 mx-auto text-center font-bold text-xs ${
                              diff !== 0 ? 'border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40' : 'bg-background'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          {diff === 0 ? (
                            <span className="text-muted-foreground font-bold">0 (Matched)</span>
                          ) : diff < 0 ? (
                            <span className="font-black text-rose-600 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-md">
                              {diff} (Shortage)
                            </span>
                          ) : (
                            <span className="font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                              +{diff} (Overage)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-bold">
                          {diff !== 0 ? (
                            <span className={diff < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                              {diff < 0 ? `-₹${Math.abs(lossGain).toFixed(0)}` : `+₹${lossGain.toFixed(0)}`}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Damaged & Spoiled Stock Write-Off */}
      {activeTab === 'damaged' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground">
              Damaged Goods & Loss Write-Off Register
            </h3>
            <Button
              onClick={() => setShowDamageModal(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 rounded-xl"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Report Damaged Stock
            </Button>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
            {damagedItems.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No damaged stock recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {damagedItems.map(item => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-foreground">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        Damaged Qty: <span className="font-bold text-rose-600">{item.qty} units</span> | Reason: <span className="capitalize font-semibold">{item.reason}</span>
                      </p>
                      {item.notes && <p className="text-[11px] text-muted-foreground italic mt-0.5">{item.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-black text-rose-600 text-sm">Total Loss: ₹{item.totalLoss.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Dead & Slow-Moving Stock Analysis */}
      {activeTab === 'deadstock' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800">
            <p className="font-bold text-sm text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              Dead Stock Capital Alert
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              These products have had zero sales in the past 30 days, locking up ₹{stockMovementAnalysis.totalDeadStockCapital.toLocaleString()} in working capital. Run promotional offers to liquidate and free up cash!
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
            <div className="p-3 bg-muted/40 font-bold text-xs border-b">
              Slow-Moving / Dead Inventory List
            </div>
            <div className="divide-y divide-border/60">
              {stockMovementAnalysis.deadStock.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  🎉 Excellent! No dead inventory in store. All products are actively moving!
                </div>
              ) : (
                stockMovementAnalysis.deadStock.map(({ product, blockedCapital }) => (
                  <div key={product.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Holding Stock: <span className="font-bold text-foreground">{product.stock} {product.unit}</span> | Rack: {product.rackLocation || '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-rose-600 text-sm">Blocked Capital: ₹{blockedCapital.toFixed(0)}</p>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        0 Sales
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Stock Movements Audit History */}
      {activeTab === 'movements' && (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
          <div className="p-3 bg-muted/40 font-bold text-xs border-b flex items-center gap-1.5">
            <History className="h-4 w-4 text-primary" /> Stock Inward / Outward Audit Trail
          </div>
          <div className="divide-y divide-border/60">
            {stockMovements.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No stock movement history recorded yet.
              </div>
            ) : (
              stockMovements.map(m => (
                <div key={m.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-sm text-foreground">{m.productName}</p>
                    <p className="text-muted-foreground">
                      Stock Change: <span className="font-bold">{m.previousStock}</span> ➔ <span className="font-bold text-foreground">{m.newStock}</span> ({m.reason || m.type})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.newStock > m.previousStock ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {m.newStock > m.previousStock ? `+${m.qty} Inward` : `-${m.qty} Outward`}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(m.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Damaged Goods Record Modal */}
      {showDamageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-card border rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-base text-foreground flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" /> Report Damaged / Broken Goods
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowDamageModal(false)} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleRecordDamaged} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Select Product:</label>
                <select
                  required
                  value={selectedDamageProduct?.id || ''}
                  onChange={e => {
                    const found = products.find(p => p.id === e.target.value);
                    setSelectedDamageProduct(found || null);
                  }}
                  className="w-full h-10 px-3 rounded-xl border bg-background text-xs font-medium"
                >
                  <option value="">-- Select Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (In-Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Damaged Quantity:</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={damageQty}
                    onChange={e => setDamageQty(e.target.value)}
                    className="h-10 text-xs bg-background rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Reason for Damage:</label>
                  <select
                    value={damageReason}
                    onChange={e => setDamageReason(e.target.value as any)}
                    className="w-full h-10 px-2 rounded-xl border bg-background text-xs font-medium"
                  >
                    <option value="broken">Broken</option>
                    <option value="leaked">Leaked / Spilled</option>
                    <option value="expired">Expired / Spoiled</option>
                    <option value="rodent_pest">Rodent / Pest Damage</option>
                    <option value="packaging_torn">Packaging Torn</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Optional Notes:</label>
                <Input
                  placeholder="e.g. Bottle broke during transit or shelf fall"
                  value={damageNotes}
                  onChange={e => setDamageNotes(e.target.value)}
                  className="h-10 text-xs bg-background rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowDamageModal(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl">
                  Confirm &amp; Deduct Stock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner for Inventory AI Scan */}
      {showCameraScanner && (
        <CameraScanner
          onScan={(code) => {
            setShowCameraScanner(false);
            if (cameraScanTarget === 'stock_search') {
              setSearchTerm(code);
              setAiBarcodeInput(code);
            } else {
              setAiBarcodeInput(code);
              handleAiBarcodeLookup(code);
            }
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}
    </div>
  );
}