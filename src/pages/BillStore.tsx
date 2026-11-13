import { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Search, Printer, MessageCircle, Eye, 
  Trash2, RefreshCw, Calendar, IndianRupee,
  CreditCard, Smartphone, Banknote, User,
  X, AlertTriangle, Filter
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import type { Transaction, Customer } from '../types';

export default function BillStore() {
  const { shopData } = useAuth();
  const [sales, setSales] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // 1-month limitation by default to keep DB & memory lightweight
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | 'thisMonth' | 'customMonth' | 'all'>('thisMonth');
  const [customMonth, setCustomMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedBill, setSelectedBill] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const [txList, custList] = await Promise.all([
        api.transactions.list(),
        api.customers.list()
      ]);
      setSales(Array.isArray(txList) ? txList : []);
      setCustomers(Array.isArray(custList) ? custList : []);
    } catch (err: any) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [shopData?.shopId]);

  // Robust date parser
  const parseBillDate = (dVal: any): Date | null => {
    if (!dVal) return null;
    if (dVal instanceof Date) return isNaN(dVal.getTime()) ? null : dVal;
    let s = String(dVal).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s) && !s.includes('Z') && !s.includes('+')) {
      s = s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  // Customer map for rapid lookup
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  // Filtered Bills
  const filteredBills = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return sales.filter((bill) => {
      // 1. Date filter
      if (dateFilter !== 'all' && bill.createdAt) {
        const d = parseBillDate(bill.createdAt);
        if (d) {
          if (dateFilter === 'today') {
            if (d < todayStart) return false;
          } else if (dateFilter === 'yesterday') {
            if (d < yesterdayStart || d >= todayStart) return false;
          } else if (dateFilter === '7days') {
            if (d < sevenDaysAgo) return false;
          } else if (dateFilter === 'thisMonth') {
            if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
          } else if (dateFilter === 'customMonth' && customMonth) {
            const [y, m] = customMonth.split('-').map(Number);
            if (d.getFullYear() !== y || d.getMonth() !== (m - 1)) return false;
          }
        }
      }

      // 2. Payment mode filter
      if (paymentFilter !== 'all') {
        if (bill.paymentMethod !== paymentFilter) return false;
      }

      // 3. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const billIdMatch = String(bill.id || '').toLowerCase().includes(q);
        const cust = bill.customerId ? customerMap.get(bill.customerId) : null;
        const custNameMatch = cust?.name?.toLowerCase().includes(q) || false;
        const custPhoneMatch = cust?.phone?.includes(q) || false;
        const itemsMatch = bill.items?.some(it => it.name?.toLowerCase().includes(q)) || false;

        if (!billIdMatch && !custNameMatch && !custPhoneMatch && !itemsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [sales, dateFilter, paymentFilter, searchTerm, customerMap]);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let udharTotal = 0;
    let udharCount = 0;

    filteredBills.forEach(b => {
      const amt = Number(b.totalAmount) || 0;
      totalRevenue += amt;
      if (b.paymentMethod === 'cash') cashTotal += amt;
      else if (b.paymentMethod === 'upi') upiTotal += amt;
      else if (b.paymentMethod === 'udhar') {
        udharTotal += amt;
        udharCount++;
      }
    });

    return {
      count: filteredBills.length,
      revenue: totalRevenue,
      cash: cashTotal,
      upi: upiTotal,
      udhar: udharTotal,
      udharCount,
      avg: filteredBills.length > 0 ? totalRevenue / filteredBills.length : 0
    };
  }, [filteredBills]);

  // Cancel Bill (Move to Recycle Bin)
  const handleCancelBill = async (bill: Transaction) => {
    if (!window.confirm(`Are you sure you want to cancel Invoice #${String(bill.id).slice(-6).toUpperCase()} and move it to Recycle Bin?`)) {
      return;
    }
    setActionLoading(bill.id);
    try {
      await api.transactions.delete(bill.id, false, bill);
      setStatusMessage(`Invoice #${String(bill.id).slice(-6).toUpperCase()} moved to Recycle Bin. You can restore it anytime.`);
      await fetchBills();
    } catch (err: any) {
      alert('Failed to cancel invoice: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(null);
    }
  };

  // Re-print thermal receipt
  const printThermalReceipt = (bill: Transaction) => {
    const cust = bill.customerId ? customerMap.get(bill.customerId) : null;
    const printWindow = window.open('', '', 'width=380,height=600');
    if (!printWindow) return;

    const itemsHtml = (bill.items || []).map((it, idx) => `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;">
        <span style="flex:1;">${idx + 1}. ${it.name}</span>
        <span style="width:45px;text-align:right;">${it.qty}</span>
        <span style="width:60px;text-align:right;">₹${(it.sellingPrice * it.qty).toFixed(2)}</span>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${String(bill.id).slice(-6).toUpperCase()}</title>
          <style>
            body { font-family: monospace, sans-serif; margin: 0; padding: 12px; font-size: 12px; color: #000; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="margin:0;font-size:16px;">${shopData?.name || 'Retail Store'}</h2>
            <p style="margin:2px 0;font-size:11px;">${shopData?.address || ''}</p>
            <p style="margin:2px 0;font-size:11px;">Phone: ${shopData?.phone || ''} ${shopData?.gstNumber ? '| GST: ' + shopData.gstNumber : ''}</p>
          </div>
          <div class="line"></div>
          <div class="row"><span>Invoice No: #${String(bill.id).slice(-8).toUpperCase()}</span><span>Mode: ${bill.paymentMethod?.toUpperCase()}</span></div>
          <div class="row"><span>Date: ${new Date(bill.createdAt).toLocaleString()}</span></div>
          ${cust ? `<div class="row"><span>Customer: ${cust.name}</span><span>${cust.phone || ''}</span></div>` : ''}
          <div class="line"></div>
          <div style="display:flex;justify-content:space-between;font-weight:bold;margin-bottom:4px;font-size:12px;">
            <span style="flex:1;">Item</span><span style="width:45px;text-align:right;">Qty</span><span style="width:60px;text-align:right;">Total</span>
          </div>
          <div class="line"></div>
          ${itemsHtml}
          <div class="line"></div>
          <div class="row"><span>Subtotal:</span><span>₹${bill.subtotal?.toFixed(2)}</span></div>
          ${bill.discountAmount ? `<div class="row"><span>Discount:</span><span>-₹${bill.discountAmount?.toFixed(2)}</span></div>` : ''}
          ${bill.taxAmount ? `<div class="row"><span>Tax (GST):</span><span>+₹${bill.taxAmount?.toFixed(2)}</span></div>` : ''}
          <div class="line"></div>
          <div class="row bold" style="font-size:15px;"><span>GRAND TOTAL:</span><span>₹${bill.totalAmount?.toFixed(2)}</span></div>
          <div class="line"></div>
          <p class="center" style="margin:10px 0 0;font-size:11px;">Thank you! Visit again! 🙏</p>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // WhatsApp Sender
  const sendWhatsAppReceipt = (bill: Transaction) => {
    const cust = bill.customerId ? customerMap.get(bill.customerId) : null;
    const phone = cust?.phone || '';
    if (!phone) {
      const manualPhone = prompt('Enter customer 10-digit mobile number:');
      if (!manualPhone) return;
      openWhatsAppUrl(manualPhone, bill);
    } else {
      openWhatsAppUrl(phone, bill);
    }
  };

  const openWhatsAppUrl = (rawPhone: string, bill: Transaction) => {
    const clean = rawPhone.replace(/\D/g, '').slice(-10);
    const billItemsText = (bill.items || [])
      .map((it, idx) => `${idx + 1}. ${it.name} x ${it.qty} = ₹${(it.sellingPrice * it.qty).toFixed(2)}`)
      .join('\n');

    const msg = `Hello! 🙏\n\nHere are your bill details from *${shopData?.name || 'Our Store'}*:\n` +
      `🧾 *Invoice No:* #${String(bill.id).slice(-6).toUpperCase()}\n` +
      `📅 *Date:* ${new Date(bill.createdAt).toLocaleDateString()}\n` +
      `💳 *Payment Mode:* ${bill.paymentMethod?.toUpperCase()}\n\n` +
      `📦 *Items Purchased:*\n${billItemsText}\n\n` +
      `💰 *Total Amount:* ₹${bill.totalAmount?.toFixed(2)}\n\n` +
      `Thank you for shopping with us! 😊`;

    const url = `https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Bill Store & Invoices
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Search, reprint, share on WhatsApp, and review past sales invoices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchBills} 
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{statusMessage}</span>
          <Button variant="ghost" size="sm" onClick={() => setStatusMessage(null)} className="h-6 text-[10px]">
            Dismiss
          </Button>
        </div>
      )}

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-blue-500" /> Total Invoices
          </p>
          <p className="text-2xl font-black text-foreground mt-1">{summary.count}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Average: ₹{summary.avg.toFixed(0)} / bill</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <IndianRupee className="h-4 w-4 text-emerald-500" /> Total Revenue
          </p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{summary.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Selected period</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Smartphone className="h-4 w-4 text-indigo-500" /> Cash & UPI Collected
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-black text-foreground">₹{(summary.cash + summary.upi).toLocaleString('en-IN')}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Cash: ₹{summary.cash.toFixed(0)} | UPI: ₹{summary.upi.toFixed(0)}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-rose-500" /> Credit / Udhar Bills
          </p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            ₹{summary.udhar.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{summary.udharCount} credit invoices</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Invoice #, customer name, phone, or item name..."
              className="pl-9 text-xs font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Payment Method Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0 font-medium">Payment Mode:</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Modes</option>
              <option value="cash">💵 Cash</option>
              <option value="upi">📱 UPI / QR</option>
              <option value="udhar">📕 Credit (Udhar)</option>
              <option value="card">💳 Card</option>
              <option value="split">⚡ Split Payment</option>
            </select>
          </div>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 mr-1">
            <Calendar className="h-3.5 w-3.5 text-primary" /> Period:
          </span>
          {[
            { id: 'thisMonth', label: 'This Month' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: 'all', label: 'All Invoices' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setDateFilter(pill.id as any)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                dateFilter === pill.id
                  ? 'bg-primary text-white border-primary font-bold shadow-2xs'
                  : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted font-medium'
              }`}
            >
              {pill.label}
            </button>
          ))}

          {/* Month Calendar Picker */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
            dateFilter === 'customMonth'
              ? 'bg-primary text-white border-primary font-bold shadow-2xs'
              : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted font-medium'
          }`}>
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="text-xs font-bold shrink-0">Month:</span>
            <input
              type="month"
              value={customMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setCustomMonth(e.target.value);
                  setDateFilter('customMonth');
                }
              }}
              className="bg-transparent border-none text-xs font-bold cursor-pointer focus:outline-none focus:ring-0 p-0 text-inherit font-mono"
            />
          </div>
          <span className="ml-auto text-xs text-muted-foreground font-semibold">
            {filteredBills.length} invoices found
          </span>
        </div>
      </div>

      {/* Bills Table / Cards */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
            <p className="text-xs">Loading invoices...</p>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-semibold text-sm">No invoices found</p>
            <p className="text-xs">Try changing the search query or date filter above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider font-bold border-b">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Payment Mode</th>
                  <th className="px-4 py-3">Items Summary</th>
                  <th className="px-4 py-3 text-right">Total (₹)</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBills.map((bill) => {
                  const cust = bill.customerId ? customerMap.get(bill.customerId) : null;
                  const billShortId = String(bill.id || '').slice(-6).toUpperCase();
                  const itemCount = bill.items?.length || 0;
                  const previewNames = (bill.items || []).slice(0, 2).map(it => it.name).join(', ');

                  return (
                    <tr key={bill.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        #{billShortId}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        <p className="font-semibold text-foreground">
                          {bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {bill.createdAt ? new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        {cust ? (
                          <div>
                            <p className="font-bold text-foreground flex items-center gap-1">
                              <User className="h-3 w-3 text-primary" /> {cust.name}
                            </p>
                            {cust.phone && (
                              <p className="text-[10px] text-muted-foreground font-mono">
                                📞 {cust.phone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Walk-in Customer</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          bill.paymentMethod === 'cash' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' 
                            : bill.paymentMethod === 'upi'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300'
                            : bill.paymentMethod === 'udhar'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {bill.paymentMethod}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={bill.items?.map(i => `${i.name} (${i.qty})`).join(', ')}>
                        <span className="font-semibold text-foreground">{itemCount} items:</span> {previewNames}
                        {itemCount > 2 && '...'}
                      </td>

                      <td className="px-4 py-3 text-right font-black text-sm text-foreground">
                        ₹{Number(bill.totalAmount || 0).toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedBill(bill)}
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => printThermalReceipt(bill)}
                            className="h-8 w-8 text-foreground hover:bg-muted"
                            title="Print Receipt"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => sendWhatsAppReceipt(bill)}
                            className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            title="Share on WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={actionLoading === bill.id}
                            onClick={() => handleCancelBill(bill)}
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Cancel Invoice (Move to Recycle Bin)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Invoice Inspector Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-card border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Invoice Details
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  #{String(selectedBill.id).slice(-8).toUpperCase()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedBill(null)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Bill Header Info */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-xl">
              <div>
                <p className="text-muted-foreground">Date & Time:</p>
                <p className="font-bold">{new Date(selectedBill.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment Mode:</p>
                <p className="font-bold uppercase text-primary">{selectedBill.paymentMethod}</p>
              </div>
              {selectedBill.customerId && customerMap.get(selectedBill.customerId) && (
                <div className="col-span-2 pt-2 border-t">
                  <p className="text-muted-foreground">Customer:</p>
                  <p className="font-bold text-foreground">
                    {customerMap.get(selectedBill.customerId)?.name} ({customerMap.get(selectedBill.customerId)?.phone || 'No phone'})
                  </p>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">Item Breakdown:</p>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground text-[10px] font-bold uppercase">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedBill.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-bold text-foreground">
                          {it.name}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{it.qty}</td>
                        <td className="px-3 py-2 text-right">₹{it.sellingPrice}</td>
                        <td className="px-3 py-2 text-right font-bold">
                          ₹{(it.sellingPrice * it.qty).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-1.5 pt-2 border-t text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span>₹{selectedBill.subtotal?.toFixed(2)}</span>
              </div>
              {selectedBill.discountAmount ? (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount:</span>
                  <span>-₹{selectedBill.discountAmount?.toFixed(2)}</span>
                </div>
              ) : null}
              {selectedBill.taxAmount ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (GST):</span>
                  <span>+₹{selectedBill.taxAmount?.toFixed(2)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-black text-foreground pt-1 border-t">
                <span>Grand Total:</span>
                <span>₹{selectedBill.totalAmount?.toFixed(2)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => printThermalReceipt(selectedBill)}
                className="flex-1 text-xs"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Receipt
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendWhatsAppReceipt(selectedBill)}
                className="flex-1 text-xs text-emerald-600 border-emerald-300 dark:border-emerald-800"
              >
                <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp Receipt
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
