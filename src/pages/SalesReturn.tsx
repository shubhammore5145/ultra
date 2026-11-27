import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  RotateCcw, Search, Barcode, Camera, CheckCircle2, 
  Printer, ArrowLeft, Calendar, User, Phone, IndianRupee, 
  CreditCard, Wallet, Package, Loader2, RefreshCw, X,
  ShoppingBag, ShieldCheck, ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CameraScanner } from '../components/CameraScanner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product, Transaction, SalesReturn as SalesReturnType } from '../types';
import JsBarcode from 'jsbarcode';

interface ReturnItemState {
  productId: string;
  name: string;
  unit?: string;
  sellingPrice: number;
  mrp: number;
  purchasedQty: number;
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
  } | null>(null);

  // Active Tab: 'new_return' | 'history'
  const [activeTab, setActiveTab] = useState<'new_return' | 'history'>('new_return');

  // Load Initial Data
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [txList, prodList, retList] = await Promise.all([
        api.transactions.list(),
        api.products.list(),
        api.salesReturns.list()
      ]);
      setTransactions(Array.isArray(txList) ? txList : []);
      setProducts(Array.isArray(prodList) ? prodList : []);
      setReturnsHistory(Array.isArray(retList) ? retList : []);
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
  const handleSelectTransaction = (tx: Transaction) => {
    setSelectedTx(tx);
    const rawItems = Array.isArray(tx.items) ? tx.items : [];
    
    // Parse items to returnable state
    const parsed: ReturnItemState[] = rawItems.map((it: any) => {
      const sp = Number(it.sellingPrice || it.price || 0);
      const mrp = Number(it.mrp || sp);
      const pQty = Number(it.qty || 1);
      return {
        productId: it.productId || it.id || '',
        name: it.name || it.productName || 'Product',
        unit: it.unit || '',
        sellingPrice: sp,
        mrp: mrp,
        purchasedQty: pQty,
        returnQty: 1,
        selected: false,
        condition: 'resellable'
      };
    });

    setReturnItems(parsed);
    setSearchQuery('');
    setCompletedReturn(null);
  };

  // Find bill by Barcode or Text
  const handleSearchBill = (codeToFind?: string) => {
    const rawQuery = (codeToFind !== undefined ? codeToFind : searchQuery).trim();
    if (!rawQuery) return;

    const clean = rawQuery.replace(/^[#\s]+/, '').toLowerCase();

    // 1. Exact or partial match on ID
    const found = transactions.find(t => {
      const tId = String(t.id || '').toLowerCase();
      const shortId = tId.slice(-8);
      const short12 = tId.slice(-12);
      return tId === clean || shortId === clean || short12 === clean || tId.includes(clean);
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

  // Toggle item selection
  const handleToggleItem = (index: number) => {
    setReturnItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, selected: !item.selected };
      }
      return item;
    }));
  };

  // Update return quantity
  const handleUpdateQty = (index: number, newQty: number) => {
    setReturnItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        const clamped = Math.max(1, Math.min(newQty, item.purchasedQty));
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

  // Calculate Total Refund
  const totalRefundAmount = useMemo(() => {
    return returnItems
      .filter(it => it.selected)
      .reduce((sum, it) => sum + (it.sellingPrice * it.returnQty), 0);
  }, [returnItems]);

  const selectedCount = useMemo(() => {
    return returnItems.filter(it => it.selected).length;
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
    const selected = returnItems.filter(it => it.selected);
    if (!selectedTx || selected.length === 0) {
      alert('Please select at least 1 item to return.');
      return;
    }

    if (totalRefundAmount <= 0) {
      alert('Refund amount cannot be zero.');
      return;
    }

    const reasonText = customReason.trim() ? `${returnReason}: ${customReason.trim()}` : returnReason;

    setActionLoading(true);
    const restockedNames: string[] = [];

    try {
      // 1. RESTOCK INVENTORY FOR RESELLABLE ITEMS
      for (const item of selected) {
        const targetProd = products.find(p => 
          (item.productId && p.id === item.productId) || 
          p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );

        if (targetProd) {
          if (item.condition === 'resellable') {
            const currentStock = Number(targetProd.stock || 0);
            const newStock = currentStock + Number(item.returnQty);

            // Update product stock in MongoDB backend
            await api.products.update(targetProd.id, {
              ...targetProd,
              stock: newStock
            });

            // Log stock movement audit trail
            await api.stockMovements.log({
              id: crypto.randomUUID(),
              productId: targetProd.id,
              productName: targetProd.name,
              qty: item.returnQty,
              previousStock: currentStock,
              newStock: newStock,
              type: 'return_inward',
              reason: `Sales Return from Bill #${selectedTx.id?.slice(-8).toUpperCase()}`,
              createdAt: new Date().toISOString()
            });

            restockedNames.push(`${item.name} (+${item.returnQty})`);
          } else {
            // Damaged goods write-off
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
        }
      }

      // 2. CREATE SALES RETURN RECORD
      const returnRecordId = 'RET-' + Date.now().toString().slice(-8);
      const newReturnRecord: SalesReturnType = {
        id: returnRecordId,
        originalBillId: selectedTx.id,
        customerId: selectedTx.customerId,
        customerName: selectedTx.customerName || 'Walk-in Customer',
        customerPhone: selectedTx.customerPhone || '',
        items: selected.map(it => ({
          productId: it.productId,
          productName: it.name,
          qty: it.returnQty,
          sellingPrice: it.sellingPrice,
          refundAmount: it.sellingPrice * it.returnQty,
          condition: it.condition
        })),
        totalRefund: totalRefundAmount,
        refundMethod: refundMethod === 'udhar' ? 'credit_note' : (refundMethod === 'upi' ? 'upi' : 'cash'),
        reason: reasonText,
        createdAt: new Date().toISOString()
      };

      await api.salesReturns.create(newReturnRecord);

      // Refresh product list and return history
      const [updatedProds, updatedReturns] = await Promise.all([
        api.products.list(),
        api.salesReturns.list()
      ]);
      setProducts(updatedProds);
      setReturnsHistory(updatedReturns);

      // Set Completed State for Voucher Printing
      setCompletedReturn({
        returnRecord: newReturnRecord,
        restockedItems: restockedNames
      });

      setSelectedTx(null);
      setReturnItems([]);
      setCustomReason('');
    } catch (err: any) {
      console.error('Failed to process sales return:', err);
      alert('Error processing sales return: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Print Return Refund Voucher
  const handlePrintVoucher = (record: SalesReturnType) => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      alert('Please allow browser popups to print the return slip.');
      return;
    }

    const shopName = shopData?.shopName || shopData?.name || 'KIRANA STORE';
    const shopPhone = shopData?.phone || '';
    const dateStr = new Date(record.createdAt).toLocaleDateString('en-IN');
    const timeStr = new Date(record.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const itemsRows = record.items.map((it, idx) => `
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;padding:3px 0;border-bottom:1px dotted #000;font-size:11.5px;">
        <span style="flex:1;min-width:0;font-weight:700;word-break:break-word;">${idx + 1}. ${it.productName} (x${it.qty}) [${it.condition === 'resellable' ? 'Good' : 'Damaged'}]</span>
        <span style="flex-shrink:0;white-space:nowrap;font-weight:900;font-variant-numeric:tabular-nums;">₹${it.refundAmount.toFixed(2)}</span>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Sales Return Voucher #${record.id}</title>
          <style>
            @page { margin: 0mm; size: 80mm auto; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              width: 100%;
              max-width: 80mm;
              margin: 0 auto;
              padding: 1.5mm 2mm;
              color: #000;
              background: #fff;
              font-size: 11.5px;
              line-height: 1.3;
              font-variant-numeric: tabular-nums;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .dashed { border-bottom: 1.5px dashed #000; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="margin:0 0 2px;font-size:17px;font-weight:900;">${shopName.toUpperCase()}</h2>
            ${shopPhone ? `<p style="margin:2px 0;font-weight:700;">Ph: ${shopPhone}</p>` : ''}
            <div style="border-top:1.5px dashed #000;border-bottom:1.5px dashed #000;padding:3px 0;margin:5px 0;font-weight:900;font-size:11.5px;">
              *** SALES RETURN & REFUND VOUCHER ***
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;gap:4px;font-size:11px;font-weight:600;">
            <span><b>Voucher:</b> #${record.id}</span>
            <span style="white-space:nowrap;"><b>Date:</b> ${dateStr}</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:4px;font-size:11px;font-weight:600;">
            <span><b>Orig Bill:</b> #${record.originalBillId?.slice(-8).toUpperCase()}</span>
            <span style="white-space:nowrap;"><b>Time:</b> ${timeStr}</span>
          </div>
          ${record.customerName ? `<div style="font-size:11px;margin-top:2px;font-weight:600;"><b>Customer:</b> ${record.customerName} ${record.customerPhone ? `(${record.customerPhone})` : ''}</div>` : ''}
          <div class="dashed"></div>
          <div style="font-weight:900;font-size:11.5px;margin-bottom:4px;">RETURNED ITEMS:</div>
          ${itemsRows}
          <div class="dashed"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:900;margin:4px 0;">
            <span>TOTAL REFUND:</span>
            <span style="white-space:nowrap;">₹${record.totalRefund.toFixed(2)}</span>
          </div>
          <div style="font-size:11px;font-weight:700;">Refund Mode: ${record.refundMethod.toUpperCase()}</div>
          <div style="font-size:10.5px;font-weight:600;margin-top:2px;">Reason: ${record.reason}</div>
          <div class="dashed"></div>
          <p class="center" style="margin:6px 0 2px;font-weight:900;font-size:11.5px;">Inventory Restocked Successfully</p>
          <p class="center" style="margin:4px 0 2mm;font-size:12.5px;font-weight:900;">Software by Varuag Labs</p>
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 80); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
          {completedReturn && (
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
                    Inventory successfully restocked: <strong>{completedReturn.restockedItems.join(', ') || 'Restocked'}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => handlePrintVoucher(completedReturn.returnRecord)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 rounded-xl shadow-md"
                >
                  <Printer className="h-4 w-4 mr-1.5" /> Print Return Slip
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCompletedReturn(null)}
                  className="h-10 px-4 rounded-xl font-bold"
                >
                  New Return
                </Button>
              </div>
            </div>
          )}

          {/* STEP 1: BILL SCAN & SEARCH CARD */}
          {!selectedTx && (
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Barcode className="h-5 w-5 text-amber-500" />
                  1. Scan Bill Barcode or Enter Invoice #
                </h2>
                <p className="text-xs text-muted-foreground">
                  Scan the barcode printed at the bottom of the receipt, or type the invoice number and press Enter.
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
                    {transactions.slice(0, 9).map((tx) => (
                      <div
                        key={tx.id}
                        onClick={() => handleSelectTransaction(tx)}
                        className="p-3.5 rounded-xl border bg-card hover:bg-amber-500/5 hover:border-amber-500/40 cursor-pointer transition-all space-y-1.5 group"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-xs text-foreground group-hover:text-amber-600">
                            #{tx.id?.slice(-8).toUpperCase()}
                          </span>
                          <span className="text-xs font-black text-emerald-600">
                            ₹{Number(tx.totalAmount || tx.total || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                          <span className="truncate max-w-[130px] font-medium">
                            {tx.customerName || 'Walk-in Customer'}
                          </span>
                          <span>
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    ))}
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-lg text-foreground">
                        Bill #{selectedTx.id?.slice(-8).toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-xs font-bold rounded-md uppercase">
                        {selectedTx.paymentMethod || 'Cash'}
                      </span>
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
                    ₹{Number(selectedTx.totalAmount || selectedTx.total || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Items Return Table */}
              <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      2. Select Products to Return
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Select the items being returned and adjust the return quantity.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">
                    {selectedCount} items selected
                  </span>
                </div>

                <div className="divide-y border rounded-xl overflow-hidden">
                  {returnItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                        item.selected ? 'bg-amber-500/5 dark:bg-amber-500/10' : 'bg-card'
                      }`}
                    >
                      {/* Checkbox & Item Info */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggleItem(idx)}
                          className="mt-1 h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-foreground truncate">{item.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>Rate: <strong className="text-foreground">₹{item.sellingPrice.toFixed(2)}</strong></span>
                            <span>•</span>
                            <span>Purchased: <strong>{item.purchasedQty} {item.unit}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Controls when Selected */}
                      {item.selected ? (
                        <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                          {/* Quantity Stepper */}
                          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border">
                            <button
                              onClick={() => handleUpdateQty(idx, item.returnQty - 1)}
                              className="w-7 h-7 rounded-lg bg-card hover:bg-muted font-bold flex items-center justify-center text-sm"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-bold text-sm">{item.returnQty}</span>
                            <button
                              onClick={() => handleUpdateQty(idx, item.returnQty + 1)}
                              className="w-7 h-7 rounded-lg bg-card hover:bg-muted font-bold flex items-center justify-center text-sm"
                            >
                              +
                            </button>
                          </div>

                          {/* Condition Selector (Resellable vs Damaged) */}
                          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border text-xs font-bold">
                            <button
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
                        <span className="text-xs text-muted-foreground italic">
                          Click checkbox to return this item
                        </span>
                      )}
                    </div>
                  ))}
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
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold text-muted-foreground mr-1">Refund Method:</Label>
                        <button
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
                          onClick={() => setRefundMethod('udhar')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                            refundMethod === 'udhar'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-card text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          💳 Customer Udhar / Credit
                        </button>
                        <button
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
