import { useState, useEffect } from 'react';
import { 
  Trash2, RotateCcw, Package, FileText, 
  Users, Loader2, ArrowLeft, RefreshCw 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import type { RecycleBinData } from '../types';

export default function RecycleBin() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [data, setData] = useState<RecycleBinData>({ products: [], transactions: [], customers: [] });
  const [activeTab, setActiveTab] = useState<'products' | 'transactions' | 'customers'>('products');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDeletedItems = async () => {
    setLoading(true);
    try {
      const res = await api.recycleBin.list();
      setData({
        products: res.products || [],
        transactions: res.transactions || [],
        customers: res.customers || []
      });
    } catch (err: any) {
      console.error('Failed to load recycle bin:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load recycle bin: ' + (err.message || 'Error') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedItems();
  }, []);

  const handleRestore = async (type: 'product' | 'transaction' | 'customer', id: string, name: string) => {
    setActionLoading(id);
    try {
      await api.recycleBin.restore(type, id);
      setStatusMessage({ type: 'success', text: `"${name}" restored successfully! ✅` });
      await fetchDeletedItems();
    } catch (err: any) {
      alert('Restore failed: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurge = async (type: 'product' | 'transaction' | 'customer', id: string, name: string) => {
    if (!window.confirm(`Are you sure? "${name}" will be permanently deleted and cannot be recovered!`)) {
      return;
    }
    setActionLoading(id);
    try {
      await api.recycleBin.purge(type, id);
      setStatusMessage({ type: 'success', text: `"${name}" deleted permanently.` });
      await fetchDeletedItems();
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmptyBin = async () => {
    if (!window.confirm('Warning: Are you sure you want to permanently delete all products, invoices, and customers in the Recycle Bin?')) {
      return;
    }
    setLoading(true);
    try {
      await api.recycleBin.empty();
      setStatusMessage({ type: 'success', text: 'Recycle Bin emptied completely! 🧹' });
      await fetchDeletedItems();
    } catch (err: any) {
      alert('Failed: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  const totalDeleted = (data.products.length || 0) + (data.transactions.length || 0) + (data.customers.length || 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/products">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Trash2 className="h-6 w-6 text-rose-500" /> Recycle Bin
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-10">
            Restore accidentally deleted products, invoices, and customer accounts, or purge them permanently.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDeletedItems} 
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>

          {totalDeleted > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEmptyBin}
              disabled={loading}
              className="text-xs bg-rose-600 hover:bg-rose-700 font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Empty Recycle Bin
            </Button>
          )}
        </div>
      </div>

      {/* Alert Banner */}
      {statusMessage && (
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-800 dark:text-emerald-200' 
            : 'bg-rose-50 dark:bg-rose-950/30 border-rose-500/40 text-rose-800 dark:text-rose-200'
        }`}>
          <span>{statusMessage.text}</span>
          <Button variant="ghost" size="sm" onClick={() => setStatusMessage(null)} className="h-6 text-[10px]">
            Dismiss
          </Button>
        </div>
      )}

      {/* Overview Metric Tabs */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'products'
              ? 'bg-primary/10 border-primary ring-2 ring-primary/20 shadow-xs'
              : 'bg-card hover:bg-muted/50 border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Package className="h-4 w-4 text-blue-500" /> Products
            </span>
            <span className="text-xl font-black text-foreground">{data.products.length}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Deleted items</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'transactions'
              ? 'bg-primary/10 border-primary ring-2 ring-primary/20 shadow-xs'
              : 'bg-card hover:bg-muted/50 border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-emerald-500" /> Invoices
            </span>
            <span className="text-xl font-black text-foreground">{data.transactions.length}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Cancelled bills</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'customers'
              ? 'bg-primary/10 border-primary ring-2 ring-primary/20 shadow-xs'
              : 'bg-card hover:bg-muted/50 border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-purple-500" /> Customers
            </span>
            <span className="text-xl font-black text-foreground">{data.customers.length}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Archived accounts</p>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-xs">Loading deleted items...</p>
          </div>
        ) : (
          <>
            {/* Products Tab */}
            {activeTab === 'products' && (
              <div>
                {data.products.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground space-y-2">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground/30" />
                    <p className="font-semibold text-sm">No products in Recycle Bin</p>
                    <p className="text-xs">All inventory products are active and safe.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider font-bold border-b">
                        <tr>
                          <th className="px-4 py-3">Product Name</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Price (₹)</th>
                          <th className="px-4 py-3">Stock</th>
                          <th className="px-4 py-3">Deleted Date</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.products.map((p) => (
                          <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-bold text-foreground text-sm">{p.name}</p>
                              {p.barcode && <p className="text-[10px] text-muted-foreground font-mono">Barcode: {p.barcode}</p>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{p.category || '—'}</td>
                            <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">₹{p.sellingPrice}</td>
                            <td className="px-4 py-3 font-semibold">{p.stock} {p.unit}</td>
                            <td className="px-4 py-3 text-muted-foreground text-[11px]">
                              {p.deletedAt ? new Date(p.deletedAt).toLocaleDateString() : 'Recent'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={actionLoading === p.id}
                                  onClick={() => handleRestore('product', p.id, p.name)}
                                  className="h-8 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 border-emerald-300 dark:border-emerald-800"
                                >
                                  {actionLoading === p.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                                  Restore
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionLoading === p.id}
                                  onClick={() => handlePurge('product', p.id, p.name)}
                                  className="h-8 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                >
                                  Delete Permanently
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Invoices Tab */}
            {activeTab === 'transactions' && (
              <div>
                {data.transactions.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground space-y-2">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/30" />
                    <p className="font-semibold text-sm">No invoices in Recycle Bin</p>
                    <p className="text-xs">No transactions have been cancelled.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider font-bold border-b">
                        <tr>
                          <th className="px-4 py-3">Invoice #</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Total Amount (₹)</th>
                          <th className="px-4 py-3">Payment Mode</th>
                          <th className="px-4 py-3">Items Count</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.transactions.map((t) => (
                          <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-foreground">
                              #{String(t.id).slice(-8).toUpperCase()}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3 font-black text-sm text-foreground">
                              ₹{t.totalAmount?.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                                {t.paymentMethod}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {t.items?.length || 0} items
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={actionLoading === t.id}
                                  onClick={() => handleRestore('transaction', t.id, `Bill #${t.id.slice(-6)}`)}
                                  className="h-8 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 border-emerald-300 dark:border-emerald-800"
                                >
                                  {actionLoading === t.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                                  Restore
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionLoading === t.id}
                                  onClick={() => handlePurge('transaction', t.id, `Bill #${t.id.slice(-6)}`)}
                                  className="h-8 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                >
                                  Delete Permanently
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Customers Tab */}
            {activeTab === 'customers' && (
              <div>
                {data.customers.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground space-y-2">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30" />
                    <p className="font-semibold text-sm">No customers in Recycle Bin</p>
                    <p className="text-xs">All customer accounts are active.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider font-bold border-b">
                        <tr>
                          <th className="px-4 py-3">Customer Name</th>
                          <th className="px-4 py-3">Phone Number</th>
                          <th className="px-4 py-3">Credit Balance (₹)</th>
                          <th className="px-4 py-3">Address</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.customers.map((c) => (
                          <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-bold text-foreground">{c.name}</td>
                            <td className="px-4 py-3 font-mono text-muted-foreground">{c.phone || '—'}</td>
                            <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400">
                              ₹{(c.balance || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[150px]">{c.address || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={actionLoading === c.id}
                                  onClick={() => handleRestore('customer', c.id, c.name)}
                                  className="h-8 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 border-emerald-300 dark:border-emerald-800"
                                >
                                  {actionLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                                  Restore
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionLoading === c.id}
                                  onClick={() => handlePurge('customer', c.id, c.name)}
                                  className="h-8 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                >
                                  Delete Permanently
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
