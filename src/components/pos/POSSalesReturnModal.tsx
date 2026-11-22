import React from 'react';
import { RotateCcw, Search, Loader2, CheckCircle2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface POSSalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReturnTx: any | null;
  setSelectedReturnTx: (tx: any | null) => void;
  returnSearchTerm: string;
  setReturnSearchTerm: (term: string) => void;
  returnLoading: boolean;
  returnAllTransactions: any[];
  selectedReturnItem: any | null;
  setSelectedReturnItem: (item: any | null) => void;
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
              <p className="text-xs text-muted-foreground">Return sold items, refund cash, or write off damaged goods.</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => { onClose(); setSelectedReturnTx(null); }} 
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
                    .map(tx => (
                      <div
                        key={tx.id}
                        onClick={() => setSelectedReturnTx(tx)}
                        className="p-3 hover:bg-muted/50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                      >
                        <div>
                          <p className="font-bold text-foreground">Invoice #{tx.id?.slice(0, 8).toUpperCase()}</p>
                          <p className="text-muted-foreground">
                            {new Date(tx.createdAt || tx.date).toLocaleDateString()} • {tx.customerName || 'Walk-in'} {tx.customerPhone ? `(${tx.customerPhone})` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm text-foreground">₹{Number(tx.total || 0).toFixed(2)}</p>
                          <span className="text-[10px] text-primary font-semibold">Select Bill →</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/30 border rounded-xl p-3 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-foreground">Selected Bill: #{selectedReturnTx.id?.slice(0, 8).toUpperCase()}</p>
                  <p className="text-muted-foreground">
                    Customer: {selectedReturnTx.customerName || 'Walk-in'} • Total: ₹{Number(selectedReturnTx.total || 0).toFixed(2)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSelectedReturnTx(null)} className="h-7 text-xs">
                  Change Bill
                </Button>
              </div>

              <div>
                <Label className="text-xs font-bold text-muted-foreground mb-1.5 block">Select Item to Return:</Label>
                <div className="grid gap-2">
                  {((selectedReturnTx.items || []) as any[]).map((it: any, idx: number) => {
                    const isSelected = selectedReturnItem?.name === it.name;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedReturnItem({
                            id: it.productId || it.id,
                            name: it.name,
                            maxQty: it.qty || 1,
                            price: it.sellingPrice || it.price || 0
                          });
                          setReturnQty('1');
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                          isSelected ? 'border-primary bg-primary/5 font-bold' : 'border-border hover:bg-muted/30'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-foreground">{it.name}</p>
                          <p className="text-muted-foreground">Sold Qty: {it.qty} • Rate: ₹{(it.sellingPrice || it.price || 0).toFixed(2)}</p>
                        </div>
                        <span className="font-black text-foreground">₹{((it.sellingPrice || it.price || 0) * (it.qty || 1)).toFixed(2)}</span>
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
                        min="1"
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
                        <option value="udhar">📒 Add to Customer Credit (Udhar Balance)</option>
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
