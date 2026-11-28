import { RotateCcw, Search, Loader2, CheckCircle2, X, Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { getBillItemsReturnStatus, getBillReturnSummary } from '../../lib/salesReturnUtils';
import type { SalesReturn } from '../../types';

interface SelectedReturnItemPayload {
  itemIndex: number;
  id: string;
  name: string;
  purchasedQty: number;
  maxQty: number;
  price: number;
}

interface POSSalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReturnTx: any | null;
  setSelectedReturnTx: (tx: any | null) => void;
  returnSearchTerm: string;
  setReturnSearchTerm: (term: string) => void;
  returnLoading: boolean;
  returnAllTransactions: any[];
  returnsHistory: SalesReturn[];
  selectedReturnItem: SelectedReturnItemPayload | null;
  setSelectedReturnItem: (item: SelectedReturnItemPayload | null) => void;
  returnQty: string;
  setReturnQty: (qty: string) => void;
  returnCondition: 'resellable' | 'damaged';
  setReturnCondition: (c: 'resellable' | 'damaged') => void;
  returnRefundMethod: 'cash' | 'udhar';
  setReturnRefundMethod: (m: 'cash' | 'udhar') => void;
  returnReason: string;
  setReturnReason: (r: string) => void;
  handleProcessSalesReturn: () => void;
}

export function POSSalesReturnModal({
  isOpen,
  onClose,
  selectedReturnTx,
  setSelectedReturnTx,
  returnSearchTerm,
  setReturnSearchTerm,
  returnLoading,
  returnAllTransactions,
  returnsHistory,
  selectedReturnItem,
  setSelectedReturnItem,
  returnQty,
  setReturnQty,
  returnCondition,
  setReturnCondition,
  returnRefundMethod,
  setReturnRefundMethod,
  returnReason,
  setReturnReason,
  handleProcessSalesReturn
}: POSSalesReturnModalProps) {
  if (!isOpen) return null;

  const selectedBillSummary = selectedReturnTx
    ? getBillReturnSummary(selectedReturnTx, returnsHistory)
    : null;
  const itemStatuses = selectedReturnTx
    ? getBillItemsReturnStatus(selectedReturnTx, returnsHistory)
    : [];

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Sales Return & Exchange</h3>
              <p className="text-xs text-muted-foreground">Return full or partial remaining quantities. Already returned items are locked automatically.</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => { onClose(); setSelectedReturnTx(null); setSelectedReturnItem(null); }} 
            className="rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {!selectedReturnTx ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search bill by Invoice # or Customer Mobile..."
                  value={returnSearchTerm}
                  onChange={(e) => setReturnSearchTerm(e.target.value)}
                  className="pl-9 bg-white dark:bg-card"
                />
              </div>

              {returnLoading ? (
                <div className="py-12 flex justify-center text-primary">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="divide-y border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  {returnAllTransactions
                    .filter(tx => {
                      const query = returnSearchTerm.toLowerCase();
                      return (
                        tx.id?.toLowerCase().includes(query) ||
                        tx.customerName?.toLowerCase().includes(query) ||
                        tx.customerPhone?.includes(query)
                      );
                    })
                    .slice(0, 15)
                    .map(tx => {
                      const summary = getBillReturnSummary(tx, returnsHistory);
                      return (
                        <div
                          key={tx.id}
                          onClick={() => {
                            setSelectedReturnTx(tx);
                            setSelectedReturnItem(null);
                          }}
                          className="p-3 hover:bg-muted/50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-foreground">Invoice #{tx.id?.slice(-8).toUpperCase()}</p>
                              {summary.isFullyReturned && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 text-[10px] font-black">
                                  Already Returned
                                </span>
                              )}
                              {summary.isPartiallyReturned && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 text-[10px] font-black">
                                  Part Returned
                                </span>
                              )}
                            </div>
                            <p className="text-muted-foreground">
                              {new Date(tx.createdAt || tx.date).toLocaleDateString('en-IN')} • {tx.customerName || 'Walk-in'} {tx.customerPhone ? `(${tx.customerPhone})` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-sm text-foreground">₹{Number(tx.totalAmount ?? tx.total ?? 0).toFixed(2)}</p>
                            <span className="text-[10px] text-primary font-semibold">Select Bill →</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/30 border rounded-xl p-3 flex justify-between items-center text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground">Selected Bill: #{selectedReturnTx.id?.slice(-8).toUpperCase()}</p>
                    {selectedBillSummary?.isFullyReturned && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 text-[10px] font-black">
                        Already Returned
                      </span>
                    )}
                    {selectedBillSummary?.isPartiallyReturned && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 text-[10px] font-black">
                        Partial Return
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    Customer: {selectedReturnTx.customerName || 'Walk-in'} • Total: ₹{Number(selectedReturnTx.totalAmount ?? selectedReturnTx.total ?? 0).toFixed(2)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelectedReturnTx(null); setSelectedReturnItem(null); }}
                  className="h-7 text-xs"
                >
                  Change Bill
                </Button>
              </div>

              {selectedBillSummary?.isFullyReturned && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0" />
                  All items on this bill have already been returned.
                </div>
              )}

              <div>
                <Label className="text-xs font-bold text-muted-foreground mb-1.5 block">Select Item to Return:</Label>
                <div className="grid gap-2">
                  {itemStatuses.map((st) => {
                    const isSelected = selectedReturnItem?.itemIndex === st.itemIndex;
                    return (
                      <div
                        key={st.itemIndex}
                        onClick={() => {
                          if (st.isFullyReturned || st.remainingQty <= 0.0001) return;
                          setSelectedReturnItem({
                            itemIndex: st.itemIndex,
                            id: st.productId,
                            name: st.name,
                            purchasedQty: st.purchasedQty,
                            maxQty: st.remainingQty,
                            price: st.sellingPrice
                          });
                          setReturnQty(String(st.remainingQty >= 1 ? 1 : st.remainingQty));
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between text-xs ${
                          st.isFullyReturned
                            ? 'border-border/70 bg-muted/40 opacity-70 cursor-not-allowed'
                            : isSelected
                            ? 'border-primary bg-primary/5 font-bold cursor-pointer'
                            : 'border-border hover:bg-muted/30 cursor-pointer'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`font-bold ${st.isFullyReturned ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {st.name}
                            </p>
                            {st.isFullyReturned && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 text-[10px] font-black">
                                <Lock className="h-2.5 w-2.5" /> Already Returned
                              </span>
                            )}
                            {st.isPartiallyReturned && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 text-[10px] font-black">
                                {st.returnedQty} Returned • {st.remainingQty} Left
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            Sold Qty: {st.purchasedQty} • Rate: ₹{st.sellingPrice.toFixed(2)}
                            {st.returnedQty > 0 && ` • Returned: ${st.returnedQty}`}
                          </p>
                        </div>
                        <span className="font-black text-foreground">
                          {st.isFullyReturned ? 'Locked' : `Max ${st.remainingQty}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedReturnItem && (
                <div className="border-t pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Return Quantity (Max {selectedReturnItem.maxQty})</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.01"
                        max={selectedReturnItem.maxQty}
                        value={returnQty}
                        onChange={(e) => setReturnQty(e.target.value)}
                        className="bg-white dark:bg-card font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Refund Amount</Label>
                      <div className="h-10 px-3 bg-muted rounded-md flex items-center font-black text-emerald-600 text-sm">
                        ₹{((parseFloat(returnQty) || 0) * selectedReturnItem.price).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Item Condition</Label>
                      <select
                        value={returnCondition}
                        onChange={(e) => setReturnCondition(e.target.value as any)}
                        className="w-full h-10 rounded-md border border-input bg-card px-3 text-xs"
                      >
                        <option value="resellable">🟢 Resellable (Restock Item)</option>
                        <option value="damaged">🔴 Damaged / Defective (Scrap & Write-off)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Refund Payment Method</Label>
                      <select
                        value={returnRefundMethod}
                        onChange={(e) => setReturnRefundMethod(e.target.value as any)}
                        className="w-full h-10 rounded-md border border-input bg-card px-3 text-xs"
                      >
                        <option value="cash">💵 Cash Refund</option>
                        <option value="udhar" disabled={!selectedReturnTx.customerId}>
                          📒 Add to Customer Credit (Udhar Balance){!selectedReturnTx.customerId ? ' (Customer required)' : ''}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Return Reason</Label>
                    <Input
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="e.g. Defective seal, Customer change of mind, Expired"
                      className="bg-white dark:bg-card text-xs"
                    />
                  </div>

                  <Button
                    onClick={handleProcessSalesReturn}
                    disabled={returnLoading}
                    className="w-full font-bold bg-primary text-primary-foreground shadow-md h-10 mt-2"
                  >
                    {returnLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Confirm Return & Process Refund
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
