import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Printer, Download, Store, IndianRupee, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function Receipt() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '/api';
        const res = await fetch(`${API_URL}/public/receipt/${id}`);
        if (!res.ok) throw new Error('Receipt not found');
        const data = await res.json();
        
        // Ensure items is parsed if it's a string from DB
        if (typeof data.items === 'string') {
          try {
            data.items = JSON.parse(data.items);
          } catch (e) {
            console.error('Failed to parse items json');
            data.items = [];
          }
        } else if (!Array.isArray(data.items)) {
          data.items = [];
        }
        
        setReceipt(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchReceipt();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 text-center">
        <Store className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Receipt Not Found</h1>
        <p className="text-muted-foreground mb-6">The receipt you are looking for might have been deleted or doesn't exist.</p>
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Return to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-md print:max-w-none print:w-full print:p-0">
        
        {/* Controls - Hidden in print */}
        <div className="flex gap-2 justify-end mb-4 print:hidden">
          <Button variant="outline" size="sm" className="bg-white dark:bg-zinc-900 shadow-sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={handlePrint}>
            <Download className="mr-2 h-4 w-4" /> Save as PDF
          </Button>
        </div>

        {/* Receipt Paper */}
        <div id="receipt-paper" className="bg-white dark:bg-zinc-900 shadow-xl print:shadow-none rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative pb-10">
          
          {/* Header */}
          <div className="pt-8 pb-6 px-6 text-center border-b border-dashed border-zinc-300 dark:border-zinc-700 bg-gradient-to-b from-zinc-50/50 to-white dark:from-zinc-950/40 dark:to-zinc-900">
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-1">
              {receipt.shopName || 'KIRANA STORE'}
            </h1>
            {receipt.shopAddress && <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-[280px] mx-auto leading-tight">{receipt.shopAddress}</p>}
            {receipt.shopPhone && <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Ph: {receipt.shopPhone}</p>}
            
            <div className="inline-block mt-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200">
              GSTIN: {receipt.shopGstNumber || receipt.gstNumber || '27AABCS1429B1Z2'}
            </div>

            <div className="mt-3 text-[11px] font-bold text-zinc-500 uppercase tracking-widest border-t border-b border-dashed border-zinc-200 dark:border-zinc-800 py-1">
              *** Retail Tax Invoice ***
            </div>
          </div>

          {/* Meta Info */}
          <div className="py-4 px-6 border-b border-dashed border-zinc-300 dark:border-zinc-700 text-xs space-y-1.5 text-zinc-600 dark:text-zinc-400 bg-zinc-50/30 dark:bg-zinc-950/20">
            <div className="flex justify-between">
              <span>Date & Time:</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{new Date(receipt.createdAt || Date.now()).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>Invoice No:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">#{String(receipt.id || '').slice(-8).toUpperCase()}</span>
            </div>
            {receipt.customerName && (
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{receipt.customerName} {receipt.customerPhone ? `(${receipt.customerPhone})` : ''}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span>Payment Mode:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 uppercase px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded text-[10px]">
                {receipt.paymentMethod || 'CASH'}
              </span>
            </div>
          </div>

          {/* Items */}
          <div className="py-4 px-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500 dark:text-zinc-400">
                  <th className="pb-2 font-bold">Item & Rate</th>
                  <th className="pb-2 font-bold text-center">Qty</th>
                  <th className="pb-2 font-bold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {(receipt.items || []).map((item: any, idx: number) => {
                  const price = Number(item.sellingPrice ?? item.price ?? 0);
                  const mrp = Number(item.mrp ?? 0);
                  const qty = Number(item.qty ?? 1);
                  const total = Number(item.total ?? (price * qty));
                  const hasDiscount = mrp > price;
                  const itemSavings = hasDiscount ? (mrp - price) * qty : 0;
                  const discPercent = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
                  const unitStr = item.unit ? ` (${item.unit})` : '';

                  return (
                    <tr key={idx} className="align-top">
                      <td className="py-2.5 pr-2">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                          {idx + 1}. {item.name}{unitStr}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>Rate: ₹{price.toFixed(2)}</span>
                          {hasDiscount && (
                            <>
                              <span className="line-through text-zinc-400">MRP ₹{mrp.toFixed(2)}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded text-[10px]">
                                {discPercent}% OFF
                              </span>
                            </>
                          )}
                        </div>
                        {hasDiscount && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                            ↳ You save: ₹{itemSavings.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-center font-medium text-zinc-800 dark:text-zinc-200">
                        {qty}
                      </td>
                      <td className="py-2.5 text-right font-bold text-zinc-900 dark:text-zinc-100">
                        ₹{total.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & Calculations */}
          {(() => {
            const items = receipt.items || [];
            const totalQty = items.reduce((acc: number, it: any) => acc + Number(it.qty || 1), 0);
            const totalMrpValue = items.reduce((acc: number, it: any) => {
              const sp = Number(it.sellingPrice ?? it.price ?? 0);
              const mrp = Number(it.mrp ?? 0);
              const effectiveMrp = mrp > sp ? mrp : sp;
              return acc + (effectiveMrp * Number(it.qty || 1));
            }, 0);
            const totalProductSavings = items.reduce((acc: number, it: any) => {
              const sp = Number(it.sellingPrice ?? it.price ?? 0);
              const mrp = Number(it.mrp ?? 0);
              return acc + (mrp > sp ? (mrp - sp) * Number(it.qty || 1) : 0);
            }, 0);
            const billDiscount = Number(receipt.discountAmount || 0);
            const grandTotalSavings = totalProductSavings + billDiscount;
            const savingsPercent = totalMrpValue > 0 ? Math.round((grandTotalSavings / totalMrpValue) * 100) : 0;
            const taxVal = Number(receipt.taxAmount || 0);
            const halfTax = taxVal / 2;
            const finalTotal = Number(receipt.totalAmount || receipt.total || 0);

            return (
              <>
                <div className="bg-zinc-50 dark:bg-zinc-950/60 py-4 px-6 space-y-1.5 text-xs border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex justify-between text-zinc-500">
                    <span>Total Items / Qty:</span>
                    <span>{items.length} items / {totalQty} qty</span>
                  </div>

                  {totalMrpValue > finalTotal && (
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span>Total MRP Value:</span>
                      <span>₹{totalMrpValue.toFixed(2)}</span>
                    </div>
                  )}

                  {totalProductSavings > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Product Discount:</span>
                      <span>- ₹{totalProductSavings.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Subtotal:</span>
                    <span>₹{Number(receipt.subtotal || finalTotal).toFixed(2)}</span>
                  </div>

                  {billDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Special Discount:</span>
                      <span>- ₹{billDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  {taxVal > 0 ? (
                    <>
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>CGST:</span>
                        <span>+ ₹{halfTax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>SGST:</span>
                        <span>+ ₹{halfTax.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-zinc-500 text-[11px]">
                      <span>GST:</span>
                      <span>Included in prices</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-zinc-900 dark:border-zinc-100 text-lg font-black text-zinc-900 dark:text-zinc-100">
                    <span>NET PAYABLE</span>
                    <span className="flex items-center text-xl"><IndianRupee className="h-5 w-5 mr-0.5" />{finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Savings Banner */}
                {grandTotalSavings > 0 && (
                  <div className="mx-6 my-4 p-3.5 bg-emerald-500/10 border-2 border-dashed border-emerald-500/30 rounded-xl text-center space-y-1">
                    <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                      🎉 YOU SAVED ₹{grandTotalSavings.toFixed(2)} ({savingsPercent}%)! 🎉
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                      या बिलावर तुमची ₹{grandTotalSavings.toFixed(2)} रुपयांची बचत झाली!
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Footer */}
          <div className="pt-4 pb-2 px-6 text-center space-y-1 border-t border-zinc-100 dark:border-zinc-800">
            <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Thank You For Shopping!</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Please visit again 🙏</p>
            <p className="text-[10px] text-zinc-400 mt-2">Nayashi Kirana Smart POS</p>
          </div>
          
          {/* Decorative Zigzag Bottom */}
          <div className="absolute -bottom-2 left-0 right-0 h-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDEwIDEwLDAgMjAsMTAiIGZpbGw9IiNmMTRiNTciLz48L3N2Zz4=')] opacity-5 dark:opacity-10 print:hidden"></div>
        </div>
      </div>
    </div>
  );
}
