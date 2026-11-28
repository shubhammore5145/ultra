import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  RotateCcw, Search, Barcode, Camera, CheckCircle2, 
  Printer, ArrowLeft, Calendar, Loader2, RefreshCw, X,
  ShieldCheck, Lock, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CameraScanner } from '../components/CameraScanner';
import { api } from '../lib/api';
import { getBillItemsReturnStatus, getBillReturnSummary, roundQty } from '../lib/salesReturnUtils';
import { printReturnVoucherThermal } from '../lib/printThermalHtml';
import { useAuth } from '../contexts/AuthContext';
import type { Product, Transaction, Customer, SalesReturn as SalesReturnType } from '../types';

interface ReturnItemState {
  itemIndex: number;
  productId: string;
  name: string;
  unit?: string;
  sellingPrice: number;
  mrp: number;
  purchasedQty: number;
  alreadyReturnedQty: number;
  remainingQty: number;
  isFullyReturned: boolean;
  isPartiallyReturned: boolean;
  returnQty: number;
  selected: boolean;
  condition: 'resellable' | 'damaged';
}

export default function SalesReturn() {
  const { shopData } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [returnsHistory, setReturnsHistory] = useState<SalesReturnType[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Search & Scanner State
  const [searchQuery, setSearchQuery] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active Transaction State
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemState[]>([]);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'udhar' | 'upi'>('cash');
  const [returnReason, setReturnReason] = useState('Wrong Item Delivered');
  const [customReason, setCustomReason] = useState('');

  // Success Voucher State
  const [completedReturn, setCompletedReturn] = useState<{
    returnRecord: SalesReturnType;
    restockedItems: string[];
    sourceTx?: Transaction | null;
  } | null>(null);

  // Active Tab: 'new_return' | 'history'
  const [activeTab, setActiveTab] = useState<'new_return' | 'history'>('new_return');

  const enrichTransactions = (txList: Transaction[], custList: Customer[]): Transaction[] => {
    const custMap = new Map<string, Customer>();
    (Array.isArray(custList) ? custList : []).forEach((c) => {
      if (c?.id) custMap.set(c.id, c);
    });
    return (Array.isArray(txList) ? txList : []).map((tx) => {
      const cust = tx.customerId ? custMap.get(tx.customerId) : undefined;
      if (!cust) return tx;
      return {
        ...tx,
        customerName: tx.customerName || cust.name || '',
        customerPhone: tx.customerPhone || cust.phone || ''
      };
    });
  };

  const buildReturnItemStates = (tx: Transaction, allReturns: SalesReturnType[]): ReturnItemState[] => {
    const statuses = getBillItemsReturnStatus(tx, allReturns);
    return statuses.map((st) => ({
      itemIndex: st.itemIndex,
      productId: st.productId,
      name: st.name,
      unit: st.unit,
      sellingPrice: st.sellingPrice,
      mrp: st.mrp,
      purchasedQty: st.purchasedQty,
      alreadyReturnedQty: st.returnedQty,
      remainingQty: st.remainingQty,
      isFullyReturned: st.isFullyReturned,
      isPartiallyReturned: st.isPartiallyReturned,
      returnQty: st.isFullyReturned ? 0 : (st.remainingQty >= 1 ? 1 : st.remainingQty),
      selected: false,
      condition: 'resellable'
    }));
  };

  // Load Initial Data
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [txList, prodList, retList, custList] = await Promise.all([
        api.transactions.list(),
        api.products.list(),
        api.salesReturns.list(),
        api.customers.list().catch(() => [])
      ]);
      const enrichedTxs = enrichTransactions(txList, custList);
      const safeReturns = Array.isArray(retList) ? retList : [];
      setTransactions(enrichedTxs);
      setProducts(Array.isArray(prodList) ? prodList : []);
      setReturnsHistory(safeReturns);
    } catch (err) {
      console.error('Failed to load sales return data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Auto-focus search input on mount
  useEffect(() => {
    if (activeTab === 'new_return' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [activeTab]);

  // Handle Bill Selection
  const handleSelectTransaction = (tx: Transaction, customReturns?: SalesReturnType[]) => {
    const retSource = customReturns ?? returnsHistory;
    setSelectedTx(tx);
    setReturnItems(buildReturnItemStates(tx, retSource));
    if (!tx.customerId && refundMethod === 'udhar') {
      setRefundMethod('cash');
    }
    setSearchQuery('');
    setCompletedReturn(null);
  };

  // Find bill by Barcode or Text
  const handleSearchBill = (codeToFind?: string) => {
    const rawQuery = (codeToFind !== undefined ? codeToFind : searchQuery).trim();
    if (!rawQuery) return;

    const clean = rawQuery.replace(/^[#\s]+/, '').toLowerCase();
    const cleanBarcode = clean.replace(/^a293/, '').replace(/-/g, '');

    // 1. Exact or partial match on ID (also supports thermal barcode format A293XXXXXXXX)
    const found = transactions.find(t => {
      const tId = String(t.id || '').toLowerCase();
      const tIdCompact = tId.replace(/-/g, '');
      const shortId = tId.slice(-8);
      const short12 = tId.slice(-12);
      return (
        tId === clean ||
        shortId === clean ||
        short12 === clean ||
        tId.includes(clean) ||
        (cleanBarcode.length >= 6 && (tIdCompact.endsWith(cleanBarcode) || tIdCompact.includes(cleanBarcode)))
      );
    });

    if (found) {
      handleSelectTransaction(found);
      return;
    }

    // 2. Search by customer phone or name
    const foundByCust = transactions.find(t => {
      const p = String(t.customerPhone || '').toLowerCase();
      const n = String(t.customerName || '').toLowerCase();
      return p.includes(clean) || n.includes(clean);
    });

    if (foundByCust) {
      handleSelectTransaction(foundByCust);
      return;
    }

    alert(`⚠️ Bill not found for "${rawQuery}". Please scan the barcode or check the invoice number.`);
  };

  // Toggle item selection (locked if already returned)
  const handleToggleItem = (index: number) => {
    setReturnItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        if (item.isFullyReturned || item.remainingQty <= 0.0001) {
          return item;
        }
        const nextSelected = !item.selected;
        const safeQty =
          item.returnQty > 0 && item.returnQty <= item.remainingQty
            ? item.returnQty
            : (item.remainingQty >= 1 ? 1 : item.remainingQty);
        return { ...item, selected: nextSelected, returnQty: safeQty };
      }
      return item;
    }));
  };

  // Update return quantity (supports partial & decimal quantities capped strictly at remainingQty)
  const handleUpdateQty = (index: number, newQty: number) => {
    setReturnItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        if (item.isFullyReturned || item.remainingQty <= 0.0001) {
          return { ...item, returnQty: 0, selected: false };
        }
        const minAllowed = item.remainingQty >= 1 ? 0.01 : Math.min(0.01, item.remainingQty);
        const clamped = roundQty(Math.max(minAllowed, Math.min(Number(newQty) || minAllowed, item.remainingQty)));
        return { ...item, returnQty: clamped };
      }
      return item;
    }));
  };

  // Update return condition (resellable vs damaged)
  const handleUpdateCondition = (index: number, condition: 'resellable' | 'damaged') => {
    setReturnItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, condition };
      }
      return item;
    }));
  };

  const selectedBillSummary = useMemo(() => {
    return selectedTx ? getBillReturnSummary(selectedTx, returnsHistory) : null;
  }, [selectedTx, returnsHistory]);

  const billReturnableCount = useMemo(() => {
    return returnItems.filter(it => !it.isFullyReturned && it.remainingQty > 0.0001).length;
  }, [returnItems]);

  // Calculate Total Refund
  const totalRefundAmount = useMemo(() => {
    return returnItems
      .filter(it => it.selected && !it.isFullyReturned && it.remainingQty > 0.0001)
      .reduce((sum, it) => sum + (it.sellingPrice * it.returnQty), 0);
  }, [returnItems]);

  const selectedCount = useMemo(() => {
    return returnItems.filter(it => it.selected && !it.isFullyReturned).length;
  }, [returnItems]);

  // Today's Stats
  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todays = returnsHistory.filter(r => r.createdAt && r.createdAt.startsWith(todayStr));
    const totalAmount = todays.reduce((acc, r) => acc + Number(r.totalRefund || 0), 0);
    return {
      count: todays.length,
      amount: totalAmount
    };
  }, [returnsHistory]);

  // PROCESS THE RETURN & INVENTORY RESTOCK
  const handleConfirmReturn = async () => {
    const selected = returnItems.filter(it => it.selected && !it.isFullyReturned && it.remainingQty > 0.0001);
    if (!selectedTx || selected.length === 0) {
      alert('Please select at least 1 returnable item.');
      return;
    }

    for (const item of selected) {
      if (item.returnQty <= 0 || item.returnQty > item.remainingQty + 0.0001) {
        alert(`Invalid return quantity for "${item.name}". Maximum returnable is ${item.remainingQty}.`);
        return;
      }
    }

    if (totalRefundAmount <= 0) {
      alert('Refund amount cannot be zero.');
      return;
    }

    if (refundMethod === 'udhar' && !selectedTx.customerId) {
      alert('Customer Udhar / Credit is only available for bills linked to a registered customer. Please choose Cash or UPI Refund.');
      return;
    }

    const reasonText = customReason.trim() ? `${returnReason}: ${customReason.trim()}` : returnReason;

    setActionLoading(true);
    const restockedNames: string[] = [];

    try {
      const returnRecordId = `RET-${Date.now().toString().slice(-8)}`;
      const newReturnRecord: SalesReturnType = {
        id: returnRecordId,
        originalBillId: selectedTx.id,
        customerId: selectedTx.customerId,
        customerName: selectedTx.customerName || 'Walk-in Customer',
        customerPhone: selectedTx.customerPhone || '',
        items: selected.map(it => ({
          itemIndex: it.itemIndex,
          productId: it.productId,
          productName: it.name,
          qty: it.returnQty,
          purchasedQty: it.purchasedQty,
          sellingPrice: it.sellingPrice,
          refundAmount: Number((it.sellingPrice * it.returnQty).toFixed(2)),
          condition: it.condition
        })),
        totalRefund: Number(totalRefundAmount.toFixed(2)),
        refundMethod: refundMethod === 'udhar' ? 'credit_note' : (refundMethod === 'upi' ? 'upi' : 'cash'),
        reason: reasonText,
        createdAt: new Date().toISOString()
      };

      // 1. Validate & atomically persist return + stock restock (+ optional customer Udhar) in MongoDB
      const createRes = await api.salesReturns.create(newReturnRecord);
      const savedRecord: SalesReturnType = (createRes as any)?.items ? (createRes as SalesReturnType) : newReturnRecord;
      const serverStockRestocked = Boolean((createRes as any)?.stockRestocked);
      const stockUpdateMap = new Map<string, { previousStock: number; newStock: number; qty: number }>();
      if (Array.isArray((createRes as any)?.stockUpdates)) {
        for (const su of (createRes as any).stockUpdates) {
          if (su?.productId) stockUpdateMap.set(su.productId, su);
        }
      }

      // 2. Log local audit trails (and offline fallback stock update ONLY if device was offline)
      for (const item of selected) {
        const targetProd = products.find(p => 
          (item.productId && p.id === item.productId) || 
          p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );

        if (targetProd) {
          if (item.condition === 'resellable') {
            const su = stockUpdateMap.get(targetProd.id);
            const prevStock = su ? su.previousStock : Number(targetProd.stock || 0);
            const newStock = su ? su.newStock : roundQty(prevStock + Number(item.returnQty));

            if (!serverStockRestocked) {
              await api.products.update(targetProd.id, {
                ...targetProd,
                stock: newStock
              });
            }

            await api.stockMovements.log({
              id: crypto.randomUUID(),
              productId: targetProd.id,
              productName: targetProd.name,
              qty: item.returnQty,
              previousStock: prevStock,
              newStock: newStock,
              type: 'return_inward',
              reason: `Sales Return from Bill #${selectedTx.id?.slice(-8).toUpperCase()}`,
              createdAt: new Date().toISOString()
            });

            restockedNames.push(`${item.name} (+${item.returnQty})`);
          } else {
            await api.damagedGoods.create({
              id: crypto.randomUUID(),
              productId: targetProd.id,
              productName: targetProd.name,
              qty: item.returnQty,
              costPrice: targetProd.purchasePrice || 0,
              totalLoss: (targetProd.purchasePrice || item.sellingPrice) * item.returnQty,
              reason: 'other',
              notes: `Customer return (Damaged): ${reasonText}`,
              createdAt: new Date().toISOString()
            });
          }
        } else if (item.condition === 'resellable') {
          restockedNames.push(`${item.name} (Returned ×${item.returnQty})`);
        }
      }

      // Refresh product list and return history
      const [updatedProds, updatedReturns] = await Promise.all([
        api.products.list(),
        api.salesReturns.list()
      ]);
      setProducts(Array.isArray(updatedProds) ? updatedProds : []);
      setReturnsHistory(Array.isArray(updatedReturns) ? updatedReturns : []);

      // Set Completed State for Voucher Printing
      setCompletedReturn({
        returnRecord: savedRecord,
        restockedItems: restockedNames,
        sourceTx: selectedTx
      });

      setSelectedTx(null);
      setReturnItems([]);
      setCustomReason('');
    } catch (err: any) {
      console.error('Failed to process sales return:', err);
      // Re-sync latest returns in case another tab returned the same item first
      try {
        const latestReturns = await api.salesReturns.list();
        setReturnsHistory(latestReturns);
        if (selectedTx) {
          setReturnItems(buildReturnItemStates(selectedTx, latestReturns));
        }
      } catch {}
      alert('Unable to process sales return: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Print Return Refund Voucher (Direct Thermal Iframe - Popup-blocker proof)
  const handlePrintVoucher = (record: SalesReturnType) => {
    printReturnVoucherThermal(record, shopData);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-emerald-500/10 p-5 rounded-2xl border border-amber-500/20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-500/30">
            <RotateCcw className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Sales Return & Refund
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
              Scan receipt barcode to process returns, refund customers, and automatically restock inventory.
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="bg-card px-4 py-2.5 rounded-xl border shadow-sm flex-1 sm:flex-initial text-center">
            <span className="text-[11px] font-bold text-muted-foreground block uppercase">Today's Returns</span>
            <span className="text-lg font-black text-foreground">{todayStats.count} bills</span>
          </div>
          <div className="bg-card px-4 py-2.5 rounded-xl border shadow-sm flex-1 sm:flex-initial text-center">
            <span className="text-[11px] font-bold text-muted-foreground block uppercase">Today's Refund</span>
            <span className="text-lg font-black text-emerald-600">₹{todayStats.amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b">
        <button
          onClick={() => { setActiveTab('new_return'); setCompletedReturn(null); }}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'new_return'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Barcode className="h-4 w-4" /> New Return (Scan & Return)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" /> Return History ({returnsHistory.length})
        </button>
      </div>

      {activeTab === 'new_return' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* SUCCESS BANNER WHEN RETURN COMPLETED */}
          {completedReturn && (() => {
            const sourceRemaining = completedReturn.sourceTx
              ? getBillReturnSummary(completedReturn.sourceTx, returnsHistory).totalRemainingQty
              : 0;
            return (
              <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in zoom-in-95">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-500/30">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-200">
                      Sales Return Processed Successfully! ₹{completedReturn.returnRecord.totalRefund.toFixed(2)} Refunded.
                    </h3>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Inventory updated: <strong>{completedReturn.restockedItems.join(', ') || 'Recorded'}</strong>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Button
                    onClick={() => handlePrintVoucher(completedReturn.returnRecord)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 rounded-xl shadow-md"
                  >
                    <Printer className="h-4 w-4 mr-1.5" /> Print Return Slip
                  </Button>
                  {completedReturn.sourceTx && sourceRemaining > 0.0001 && (
                    <Button
                      variant="outline"
                      onClick={() => handleSelectTransaction(completedReturn.sourceTx!, returnsHistory)}
                      className="h-10 px-4 rounded-xl font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                    >
                      Return More from Same Bill ({sourceRemaining} left)
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setCompletedReturn(null)}
                    className="h-10 px-4 rounded-xl font-bold"
                  >
                    New Return
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* STEP 1: BILL SCAN & SEARCH CARD */}
          {!selectedTx && (
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Barcode className="h-5 w-5 text-amber-500" />
                  1. Scan Bill Barcode or Enter Invoice #
                </h2>
                <p className="text-xs text-muted-foreground">
                  Scan the barcode printed at the bottom of the receipt, or type the invoice number / customer mobile and press Enter.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Scan barcode or enter Bill # (e.g. #2DB7DB39 or customer mobile)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchBill();
                      }
                    }}
                    className="pl-11 h-13 text-base font-mono font-bold bg-muted/20 rounded-xl"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Button
                  onClick={() => handleSearchBill()}
                  className="h-13 px-6 font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md shadow-amber-500/20 text-base"
                >
                  <Search className="h-5 w-5 mr-1.5" /> Search Bill (Enter)
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowCameraScanner(true)}
                  className="h-13 px-4 font-bold border-dashed border-2 rounded-xl"
                  title="Open Camera Scanner"
                >
                  <Camera className="h-5 w-5 text-muted-foreground" />
                </Button>
              </div>

              {/* RECENT BILLS TABLE QUICK-SELECT */}
              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                  <span>Quick Select from Recent Bills:</span>
                  <button onClick={loadInitialData} className="hover:text-foreground flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="py-8 flex justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {transactions.slice(0, 12).map((tx) => {
                      const billSummary = getBillReturnSummary(tx, returnsHistory);
                      return (
                        <div
                          key={tx.id}
                          onClick={() => handleSelectTransaction(tx)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1.5 group ${
                            billSummary.isFullyReturned
                              ? 'bg-muted/40 border-border/80 opacity-85 hover:opacity-100'
                              : 'bg-card hover:bg-amber-500/5 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-mono font-bold text-xs text-foreground group-hover:text-amber-600">
                              #{tx.id?.slice(-8).toUpperCase()}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {billSummary.isFullyReturned && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black">
                                  Already Returned
                                </span>
                              )}
                              {billSummary.isPartiallyReturned && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                                  Part Returned
                                </span>
                              )}
                              <span className="text-xs font-black text-emerald-600">
                                ₹{Number(tx.totalAmount ?? (tx as any).total ?? 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                            <span className="truncate max-w-[140px] font-medium">
                              {tx.customerName || 'Walk-in Customer'}
                            </span>
                            <span>
                              {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: LOADED BILL & ITEM SELECTION */}
          {selectedTx && (
            <div className="space-y-6">
              {/* Bill Details Header Card */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3.5">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { setSelectedTx(null); setReturnItems([]); }}
                    className="rounded-xl h-10 w-10"
                    title="Search another bill"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-lg text-foreground">
                        Bill #{selectedTx.id?.slice(-8).toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-xs font-bold rounded-md uppercase">
                        {selectedTx.paymentMethod || 'Cash'}
                      </span>
                      {selectedBillSummary?.isFullyReturned && (
                        <span className="px-2.5 py-0.5 bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-black rounded-full border border-rose-500/30">
                          Already Returned
                        </span>
                      )}
                      {selectedBillSummary?.isPartiallyReturned && (
                        <span className="px-2.5 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-black rounded-full border border-amber-500/30">
                          Partial Return ({selectedBillSummary.totalReturnedQty}/{selectedBillSummary.totalPurchasedQty} Returned)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 font-medium">
                      <span>{new Date(selectedTx.createdAt).toLocaleString('en-IN')}</span>
                      <span>•</span>
                      <span>Customer: {selectedTx.customerName || 'Walk-in'} {selectedTx.customerPhone ? `(+91 ${selectedTx.customerPhone})` : ''}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-muted-foreground block font-bold">Original Bill Total</span>
                  <span className="text-2xl font-black text-foreground">
                    ₹{Number(selectedTx.totalAmount ?? (selectedTx as any).total ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Prior Return Status Alert */}
              {selectedBillSummary && selectedBillSummary.isFullyReturned && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-rose-500 text-white rounded-xl shrink-0">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-rose-800 dark:text-rose-200">
                        Already Returned — Full Bill Already Returned
                      </h4>
                      <p className="text-xs font-medium text-rose-700 dark:text-rose-300 mt-0.5">
                        All items ({selectedBillSummary.totalPurchasedQty} qty, ₹{selectedBillSummary.totalRefundedAmount.toFixed(2)} refunded) on this bill have already been returned. Duplicate returns are blocked.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('history')}
                      className="rounded-xl font-bold border-rose-400/50 text-rose-700 dark:text-rose-200"
                    >
                      View Return History
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setSelectedTx(null); setReturnItems([]); }}
                      className="rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      Select Another Bill
                    </Button>
                  </div>
                </div>
              )}

              {selectedBillSummary && selectedBillSummary.isPartiallyReturned && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-500/40 rounded-2xl flex items-center gap-3 text-xs font-semibold text-amber-800 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    Previous return recorded on this bill ({selectedBillSummary.billReturns.length} voucher{selectedBillSummary.billReturns.length > 1 ? 's' : ''}, ₹{selectedBillSummary.totalRefundedAmount.toFixed(2)} refunded). Already returned items are locked; only remaining quantities can be returned part-by-part.
                  </span>
                </div>
              )}

              {/* Items Return Table */}
              <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      2. Select Products to Return
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Return full or partial quantities of remaining items. Already returned items are locked automatically.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">
                    {selectedCount} selected • {billReturnableCount} returnable left
                  </span>
                </div>

                <div className="divide-y border rounded-xl overflow-hidden">
                  {returnItems.map((item, idx) => {
                    const stepDelta = item.remainingQty < 1 ? Math.min(0.25, item.remainingQty) : 1;
                    return (
                      <div
                        key={`${item.itemIndex}-${item.productId || item.name}`}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                          item.isFullyReturned
                            ? 'bg-muted/40 opacity-75'
                            : item.selected
                            ? 'bg-amber-500/5 dark:bg-amber-500/10'
                            : 'bg-card'
                        }`}
                      >
                        {/* Checkbox & Item Info */}
                        <div className="flex items-start gap-3.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            disabled={item.isFullyReturned || item.remainingQty <= 0.0001}
                            onChange={() => handleToggleItem(idx)}
                            className={`mt-1 h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 ${
                              item.isFullyReturned ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={`font-bold text-sm truncate ${item.isFullyReturned ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                {item.name}
                              </p>
                              {item.isFullyReturned && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-black border border-rose-500/30">
                                  <Lock className="h-2.5 w-2.5" /> Already Returned
                                </span>
                              )}
                              {item.isPartiallyReturned && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-500/30">
                                  Partial Return • {item.remainingQty} {item.unit || 'qty'} Remaining
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                              <span>Rate: <strong className="text-foreground">₹{item.sellingPrice.toFixed(2)}</strong></span>
                              <span>•</span>
                              <span>Purchased: <strong>{item.purchasedQty} {item.unit}</strong></span>
                              {item.alreadyReturnedQty > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                    Returned: <strong>{item.alreadyReturnedQty}</strong> / Remaining: <strong>{item.remainingQty} {item.unit}</strong>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controls / Status */}
                        {item.isFullyReturned ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-black shrink-0">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Already Returned ({item.alreadyReturnedQty}/{item.purchasedQty})
                          </div>
                        ) : item.selected ? (
                          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                            {/* Quantity Stepper + Direct Partial Input */}
                            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(idx, roundQty(item.returnQty - stepDelta))}
                                className="w-7 h-7 rounded-lg bg-card hover:bg-muted font-bold flex items-center justify-center text-sm"
                                title="Decrease return quantity"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="any"
                                min={0.01}
                                max={item.remainingQty}
                                value={item.returnQty}
                                onChange={(e) => {
                                  const parsed = parseFloat(e.target.value);
                                  if (!Number.isNaN(parsed)) handleUpdateQty(idx, parsed);
                                }}
                                className="w-14 h-7 text-center font-bold text-sm bg-transparent focus:outline-none tabular-nums"
                                aria-label={`Return quantity for ${item.name}`}
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(idx, roundQty(item.returnQty + stepDelta))}
                                disabled={item.returnQty >= item.remainingQty - 0.0001}
                                className="w-7 h-7 rounded-lg bg-card hover:bg-muted font-bold flex items-center justify-center text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Increase return quantity"
                              >
                                +
                              </button>
                              {item.remainingQty > 0 && item.returnQty < item.remainingQty - 0.0001 && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(idx, item.remainingQty)}
                                  className="px-2 h-7 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-[11px]"
                                  title={`Set maximum remaining (${item.remainingQty})`}
                                >
                                  Max ({item.remainingQty})
                                </button>
                              )}
                            </div>

                            {/* Condition Selector (Resellable vs Damaged) */}
                            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border text-xs font-bold">
                              <button
                                type="button"
                                onClick={() => handleUpdateCondition(idx, 'resellable')}
                                className={`px-2.5 py-1 rounded-lg transition-colors ${
                                  item.condition === 'resellable'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                ✅ Resellable (Restock)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateCondition(idx, 'damaged')}
                                className={`px-2.5 py-1 rounded-lg transition-colors ${
                                  item.condition === 'damaged'
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                ⚠️ Damaged (Write-off)
                              </button>
                            </div>

                            {/* Refund Calculation for this item */}
                            <div className="min-w-[90px] text-right font-black text-base text-emerald-600">
                              ₹{(item.sellingPrice * item.returnQty).toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleItem(idx)}
                            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline shrink-0"
                          >
                            Select to Return (Max {item.remainingQty} {item.unit})
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Refund Method & Confirmation Card */}
                {selectedCount > 0 && (
                  <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-transparent border-2 border-emerald-500/40 rounded-2xl space-y-4 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-emerald-500/20 pb-4">
                      <div>
                        <span className="text-xs font-bold text-muted-foreground block uppercase">
                          Total Refund Amount
                        </span>
                        <div className="text-3xl font-black text-emerald-600 tracking-tight">
                          ₹{totalRefundAmount.toFixed(2)}
                        </div>
                      </div>

                      {/* Refund Mode Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="text-xs font-bold text-muted-foreground mr-1">Refund Method:</Label>
                        <button
                          type="button"
                          onClick={() => setRefundMethod('cash')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                            refundMethod === 'cash'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-card text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          💵 Cash Refund
                        </button>
                        <button
                          type="button"
                          disabled={!selectedTx.customerId}
                          title={!selectedTx.customerId ? 'Available only when a customer is linked to this bill' : 'Credit back to customer Udhar balance'}
                          onClick={() => setRefundMethod('udhar')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                            refundMethod === 'udhar'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-card text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          💳 Customer Udhar / Credit
                        </button>
                        <button
                          type="button"
                          onClick={() => setRefundMethod('upi')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                            refundMethod === 'upi'
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                              : 'bg-card text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          📱 UPI
                        </button>
                      </div>
                    </div>

                    {/* Reason Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-bold text-muted-foreground">Return Reason</Label>
                        <select
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-xl border bg-card text-sm font-semibold"
                        >
                          <option value="Wrong Item Delivered">Wrong Item Delivered</option>
                          <option value="Near Expiry Date">Near Expiry Date</option>
                          <option value="Customer Changed Mind">Customer Changed Mind</option>
                          <option value="Damaged / Broken Packaging">Damaged / Broken Packaging</option>
                          <option value="Other Reason">Other Reason</option>
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-muted-foreground">Optional Notes / Remarks</Label>
                        <Input
                          placeholder="e.g. Unopened packaging, returned next day..."
                          value={customReason}
                          onChange={(e) => setCustomReason(e.target.value)}
                          className="mt-1 h-10 bg-card rounded-xl"
                        />
                      </div>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <div className="pt-2 flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedTx(null)}
                        className="h-12 px-5 font-bold rounded-xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleConfirmReturn}
                        disabled={actionLoading}
                        className="h-12 px-8 font-black text-base bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/30"
                      >
                        {actionLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        ) : (
                          <ShieldCheck className="h-5 w-5 mr-2" />
                        )}
                        Confirm Return & Refund ₹{totalRefundAmount.toFixed(2)}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RETURNS HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-foreground">Sales Return History</h2>
              <p className="text-xs text-muted-foreground">Comprehensive log of all customer returns and restocked items.</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadInitialData} className="gap-1.5 rounded-xl font-bold">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          {returnsHistory.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <RotateCcw className="h-10 w-10 mx-auto opacity-30" />
              <p className="font-bold text-sm">No sales return records found.</p>
              <p className="text-xs">Scan a bill to process your first return.</p>
            </div>
          ) : (
            <div className="divide-y border rounded-xl overflow-hidden">
              {returnsHistory.map((ret) => (
                <div key={ret.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-muted/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">#{ret.id}</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium text-muted-foreground">
                        Orig Bill: #{ret.originalBillId?.slice(-8).toUpperCase()}
                      </span>
                      <span className="text-xs bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded capitalize">
                        {ret.refundMethod}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      <span>{new Date(ret.createdAt).toLocaleString('en-IN')}</span>
                      <span> • Customer: {ret.customerName || 'Walk-in'}</span>
                      {ret.reason && <span> • Reason: {ret.reason}</span>}
                    </div>
                    {/* Items List */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ret.items.map((it, i) => (
                        <span key={i} className="text-[11px] bg-background border px-2 py-0.5 rounded-md font-semibold">
                          {it.productName} (×{it.qty}) - ₹{it.refundAmount.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground font-bold block uppercase">Refund Amount</span>
                      <span className="text-lg font-black text-emerald-600">₹{Number(ret.totalRefund || 0).toFixed(2)}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrintVoucher(ret)}
                      className="rounded-xl h-9 px-3 gap-1.5 font-bold"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print Slip
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Camera Scanner Modal */}
      {showCameraScanner && (
        <CameraScanner
          onScan={(code) => {
            setShowCameraScanner(false);
            handleSearchBill(code);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}
    </div>
  );
}
