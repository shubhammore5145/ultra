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
        <div className="bg-white dark:bg-zinc-900 shadow-xl print:shadow-none rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative pb-10">
          
          {/* Header */}
          <div className="pt-8 pb-6 px-6 text-center border-b border-dashed border-zinc-300 dark:border-zinc-700">
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-1">
              {receipt.shopName || 'STORE RECEIPT'}
            </h1>
            {receipt.shopPhone && <p className="text-sm text-zinc-500 dark:text-zinc-400">Ph: {receipt.shopPhone}</p>}
            {receipt.shopAddress && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[250px] mx-auto leading-tight">{receipt.shopAddress}</p>}
          </div>

          {/* Meta Info */}
          <div className="py-4 px-6 border-b border-dashed border-zinc-300 dark:border-zinc-700 text-sm space-y-1 text-zinc-600 dark:text-zinc-400">
            <div className="flex justify-between">
              <span>Date:</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{new Date(receipt.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Invoice No:</span>
              <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">#{String(receipt.id || '').slice(-6).toUpperCase()}</span>
            </div>
            {receipt.customerName && (
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{receipt.customerName} {receipt.customerPhone ? `(${receipt.customerPhone})` : ''}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Payment:</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100 capitalize">{receipt.paymentMethod || 'Cash'}</span>
            </div>
          </div>

          {/* Items */}
          <div className="py-4 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500 dark:text-zinc-400">
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium text-right">Qty</th>
                  <th className="pb-2 font-medium text-right">Price</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="text-zinc-700 dark:text-zinc-300">
                {(receipt.items || []).map((item: any, idx: number) => {
                  const price = Number(item.sellingPrice ?? item.price ?? 0);
                  const qty = Number(item.qty ?? 1);
                  const total = Number(item.total ?? (price * qty));
                  return (
                    <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                      <td className="py-3 pr-2 font-medium">{item.name}</td>
                      <td className="py-3 text-right">{qty}</td>
                      <td className="py-3 text-right">₹{price.toFixed(2)}</td>
                      <td className="py-3 text-right font-medium">₹{total.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="bg-zinc-50 dark:bg-zinc-950/50 py-4 px-6 space-y-2 text-sm border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Subtotal</span>
              <span>₹{Number(receipt.subtotal || receipt.totalAmount || 0).toFixed(2)}</span>
            </div>
            {Number(receipt.taxAmount || 0) > 0 && (
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Tax</span>
                <span>+ ₹{Number(receipt.taxAmount).toFixed(2)}</span>
              </div>
            )}
            {Number(receipt.discountAmount || 0) > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                <span>Discount</span>
                <span>- ₹{Number(receipt.discountAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 mt-2 border-t border-dashed border-zinc-300 dark:border-zinc-700 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              <span>Total</span>
              <span className="flex items-center"><IndianRupee className="h-4 w-4 mr-0.5" />{Number(receipt.totalAmount || receipt.total || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-6 pb-2 px-6 text-center space-y-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Thank You For Shopping!</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Please visit again</p>
          </div>
          
          {/* Decorative Zigzag Bottom */}
          <div className="absolute -bottom-2 left-0 right-0 h-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDEwIDEwLDAgMjAsMTAiIGZpbGw9IiNmMTRiNTciLz48L3N2Zz4=')] opacity-5 dark:opacity-10 print:hidden"></div>
        </div>
      </div>
    </div>
  );
}
