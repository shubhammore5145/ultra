import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Package, Search, AlertTriangle, Loader2, Save, 
  Calendar, Trash2, CheckCircle2, History,
  TrendingDown, Sparkles, Plus, X, MapPin, 
  Layers, ArrowUpDown
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import type { Product, DamagedItem, StockMovement, Transaction } from '../types';

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
  const [activeTab, setActiveTab] = useState<'stock' | 'damaged' | 'expiry' | 'audit' | 'deadstock' | 'movements'>('stock');

  // Inline Stock Edits
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});
  const [rackEdits, setRackEdits] = useState<Record<string, string>>({});

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

        <div className="flex items-center gap-2">
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
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-input bg-background text-xs font-semibold"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
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
    </div>
  );
}