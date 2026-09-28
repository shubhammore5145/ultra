import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign, Loader2, 
  Download, FileSpreadsheet, Banknote, 
  ShieldCheck, PieChart as PieIcon,
  ShoppingBag
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import { Button } from '../components/ui/button';
import type { Transaction, Product, Expense, Customer } from '../types';


export default function Reports() {
  const { shopData } = useAuth();
  const { canAccess, requireFeature, openUpgradeModal } = usePlan();
  const [sales, setSales] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [activeTab, setActiveTab] = useState<'analytics' | 'payments' | 'gstr1' | 'products' | 'udharAging' | 'exports'>('analytics');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'thisMonth' | 'lastMonth' | 'all'>('thisMonth');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [salesData, productsData, expensesData, customersData] = await Promise.all([
          api.transactions.list(),
          api.products.list(),
          api.expenses.list(),
          api.customers.list()
        ]);
        setSales(Array.isArray(salesData) ? salesData : []);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setExpenses(Array.isArray(expensesData) ? expensesData : []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
      } catch (err) {
        console.error('Failed to load report data', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [shopData?.shopId]);

  // Filter transactions by selected date range
  const filteredSales = useMemo(() => {
    const now = new Date();
    return sales.filter(s => {
      if (!s.createdAt) return false;
      const d = new Date(s.createdAt);

      if (dateFilter === 'today') {
        return d.toDateString() === now.toDateString();
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= sevenDaysAgo;
      } else if (dateFilter === 'thisMonth') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'lastMonth') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      }
      return true; // 'all'
    });
  }, [sales, dateFilter]);

  // Filter expenses by date
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    return expenses.filter(e => {
      const d = new Date(e.date || e.createdAt);
      if (dateFilter === 'today') {
        return d.toDateString() === now.toDateString();
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= sevenDaysAgo;
      } else if (dateFilter === 'thisMonth') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'lastMonth') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      }
      return true;
    });
  }, [expenses, dateFilter]);

  // Derived Analytics Data
  const analytics = useMemo(() => {
    let rev = 0;
    let grossProfit = 0;
    let totalTaxAmount = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let udharTotal = 0;

    const prodMap = new Map<string, Product>();
    products.forEach(p => prodMap.set(p.id, p));

    const daysMap = new Map<string, number>();
    const itemMap = new Map<string, { name: string, qty: number, revenue: number, gstRate: number }>();

    filteredSales.forEach(sale => {
      const saleTotal = Number(sale.totalAmount || 0);
      rev += saleTotal;
      totalTaxAmount += Number(sale.taxAmount || 0);

      const method = (sale.paymentMethod || 'cash').toLowerCase();
      if (method === 'cash') cashTotal += saleTotal;
      else if (method === 'upi') upiTotal += saleTotal;
      else if (method === 'udhar') udharTotal += saleTotal;
      else if (method === 'split') {
        cashTotal += saleTotal / 2;
        upiTotal += saleTotal / 2;
      } else {
        cashTotal += saleTotal;
      }
      
      const dateStr = new Date(sale.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      daysMap.set(dateStr, (daysMap.get(dateStr) || 0) + saleTotal);

      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach(item => {
        const dbProduct = prodMap.get(item.id);
        const purchasePrice = dbProduct?.purchasePrice || (item.sellingPrice * 0.85); // fallback 15% margin
        grossProfit += ((item.sellingPrice || 0) - purchasePrice) * (item.qty || 1);

        const existing = itemMap.get(item.id || item.name);
        if (existing) {
          existing.qty += item.qty;
          existing.revenue += (item.sellingPrice || 0) * item.qty;
        } else {
          itemMap.set(item.id || item.name, { 
            name: item.name, 
            qty: item.qty, 
            revenue: (item.sellingPrice || 0) * item.qty,
            gstRate: Number(item.gst || dbProduct?.gst || 0)
          });
        }
      });
    });

    const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = grossProfit - totalExpenseAmount;
    const profitMargin = rev > 0 ? (netProfit / rev) * 100 : 0;
    const avgOrderValue = filteredSales.length > 0 ? rev / filteredSales.length : 0;

    const topProducts = Array.from(itemMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const timelineData = Array.from(daysMap.entries())
      .map(([date, total]) => ({ date, total }))
      .slice(-14);

    const paymentMethodsData = [
      { name: 'Cash', value: cashTotal, color: '#10b981' },
      { name: 'UPI', value: upiTotal, color: '#3b82f6' },
      { name: 'Udhar (Credit)', value: udharTotal, color: '#ef4444' }
    ].filter(p => p.value > 0);

    return {
      revenue: rev,
      grossProfit,
      totalExpenses: totalExpenseAmount,
      netProfit,
      profitMargin,
      avgOrderValue,
      totalOrders: filteredSales.length,
      totalTaxAmount,
      cashTotal,
      upiTotal,
      udharTotal,
      topProducts,
      timelineData,
      paymentMethodsData,
      allItems: Array.from(itemMap.values())
    };
  }, [filteredSales, filteredExpenses, products]);

  // CA-Ready GSTR-1 Tax Slab Calculation
  const gstr1Data = useMemo(() => {
    const slabs: Record<string, { taxable: number, cgst: number, sgst: number, totalTax: number, invoiceTotal: number }> = {
      '0%': { taxable: 0, cgst: 0, sgst: 0, totalTax: 0, invoiceTotal: 0 },
      '5%': { taxable: 0, cgst: 0, sgst: 0, totalTax: 0, invoiceTotal: 0 },
      '12%': { taxable: 0, cgst: 0, sgst: 0, totalTax: 0, invoiceTotal: 0 },
      '18%': { taxable: 0, cgst: 0, sgst: 0, totalTax: 0, invoiceTotal: 0 },
      '28%': { taxable: 0, cgst: 0, sgst: 0, totalTax: 0, invoiceTotal: 0 }
    };

    filteredSales.forEach(sale => {
      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach(it => {
        const rate = Math.round(Number(it.gst || 0));
        let slabKey = '0%';
        if (rate >= 25) slabKey = '28%';
        else if (rate >= 15) slabKey = '18%';
        else if (rate >= 10) slabKey = '12%';
        else if (rate >= 3) slabKey = '5%';

        const itemTotal = (it.sellingPrice || 0) * (it.qty || 1);
        const taxRateDecimal = rate / 100;
        const taxable = itemTotal / (1 + taxRateDecimal);
        const tax = itemTotal - taxable;

        if (!slabs[slabKey]) slabs[slabKey] = { taxable: 0, cgst: 0, sgst: 0, totalTax: 0, invoiceTotal: 0 };
        slabs[slabKey].taxable += taxable;
        slabs[slabKey].cgst += tax / 2;
        slabs[slabKey].sgst += tax / 2;
        slabs[slabKey].totalTax += tax;
        slabs[slabKey].invoiceTotal += itemTotal;
      });
    });

    return slabs;
  }, [filteredSales]);

  // Udhar Aging Calculation
  const udharAging = useMemo(() => {
    let overdue0to15 = 0;
    let overdue16to30 = 0;
    let overdue30plus = 0;
    let totalOutstanding = 0;

    customers.forEach(c => {
      const bal = Number(c.balance || 0);
      if (bal > 0) {
        totalOutstanding += bal;
        const created = new Date(c.createdAt || Date.now());
        const daysOld = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOld <= 15) overdue0to15 += bal;
        else if (daysOld <= 30) overdue16to30 += bal;
        else overdue30plus += bal;
      }
    });

    return { totalOutstanding, overdue0to15, overdue16to30, overdue30plus };
  }, [customers]);

  // Export CSV Handlers
  const exportGSTR1CSV = () => {
    if (!requireFeature('gstr1_reports')) return;
    const rows = [
      [`CA-READY GSTR-1 TAX REPORT - ${(shopData?.shopName || shopData?.name || 'MARTGPT').toUpperCase()}`],
      ['Generated On', new Date().toLocaleString()],
      ['Tax Period', dateFilter.toUpperCase()],
      ['GSTIN', shopData?.gstNumber || 'Unregistered / Composition'],
      [''],
      ['Tax Slab', 'Taxable Value (₹)', 'Central Tax CGST (₹)', 'State Tax SGST (₹)', 'Total Tax (₹)', 'Gross Invoice Value (₹)']
    ];

    Object.entries(gstr1Data).forEach(([slab, val]) => {
      rows.push([
        slab,
        val.taxable.toFixed(2),
        val.cgst.toFixed(2),
        val.sgst.toFixed(2),
        val.totalTax.toFixed(2),
        val.invoiceTotal.toFixed(2)
      ]);
    });

    const csvContent = rows.map(r => r.join(',')).join('\n');
    downloadBlob(csvContent, `GSTR1_Report_${dateFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportSalesRegisterCSV = () => {
    const rows = [
      ['Invoice ID', 'Date & Time', 'Payment Mode', 'Items Count', 'Subtotal (₹)', 'Tax (₹)', 'Discount (₹)', 'Total Amount (₹)']
    ];

    filteredSales.forEach(s => {
      rows.push([
        `#${s.id.slice(-8).toUpperCase()}`,
        new Date(s.createdAt).toLocaleString(),
        s.paymentMethod || 'cash',
        String(s.items?.length || 0),
        (s.subtotal || s.totalAmount).toFixed(2),
        (s.taxAmount || 0).toFixed(2),
        (s.discountAmount || 0).toFixed(2),
        s.totalAmount.toFixed(2)
      ]);
    });

    const csvContent = rows.map(r => r.join(',')).join('\n');
    downloadBlob(csvContent, `Sales_Register_${dateFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeInUp">
      {/* Header with Date Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" /> Advanced Analytics & CA Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sales trends, profit & loss, CA-ready GSTR-1 summaries, and inventory velocity.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded-2xl border flex-wrap">
          {(['today', '7days', 'thisMonth', 'lastMonth', 'all'] as const).map(pill => (
            <button
              key={pill}
              type="button"
              onClick={() => setDateFilter(pill)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                dateFilter === pill 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {pill === 'today' ? 'Today' : 
               pill === '7days' ? 'Last 7 Days' : 
               pill === 'thisMonth' ? 'This Month' : 
               pill === 'lastMonth' ? 'Last Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Top Financial KPI Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card border-l-4 border-l-indigo-500">
          <div className="flex justify-between items-center mb-1">
            <span className="stat-label text-xs">Total Revenue</span>
            <DollarSign className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="stat-value text-indigo-600 dark:text-indigo-400">
            ₹{analytics.revenue.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{analytics.totalOrders} completed invoices</p>
        </div>

        <div className="stat-card border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-center mb-1">
            <span className="stat-label text-xs">Net Profit</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className={`stat-value ${analytics.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            ₹{analytics.netProfit.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Margin: {analytics.profitMargin.toFixed(1)}%</p>
        </div>

        <div className="stat-card border-l-4 border-l-red-500">
          <div className="flex justify-between items-center mb-1">
            <span className="stat-label text-xs">Total Expenses</span>
            <Banknote className="h-4 w-4 text-red-500" />
          </div>
          <div className="stat-value text-red-500">
            ₹{analytics.totalExpenses.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Rent, stock, electricity, misc</p>
        </div>

        <div className="stat-card border-l-4 border-l-purple-500">
          <div className="flex justify-between items-center mb-1">
            <span className="stat-label text-xs">Average Bill Value</span>
            <ShoppingBag className="h-4 w-4 text-purple-500" />
          </div>
          <div className="stat-value text-purple-600 dark:text-purple-400">
            ₹{analytics.avgOrderValue.toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Average per customer</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto pb-1 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-2 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'analytics' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          📈 Sales Trends
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-2 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'payments' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          💳 Payment Modes
        </button>

        <button
          onClick={() => setActiveTab('gstr1')}
          className={`pb-2 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'gstr1' ? 'border-emerald-600 text-emerald-600 font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>📜 CA-Ready GSTR-1</span>
          {!canAccess('gstr1_reports') && (
            <span className="text-[9px] bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded font-black">
              🔒 Plus
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`pb-2 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'products' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          ⭐ Top Products
        </button>

        <button
          onClick={() => setActiveTab('udharAging')}
          className={`pb-2 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'udharAging' ? 'border-rose-500 text-rose-500 font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          ⚠️ Udhar Aging
        </button>

        <button
          onClick={() => setActiveTab('exports')}
          className={`pb-2 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'exports' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          📥 CSV Export Center
        </button>
      </div>

      {/* ─── TAB 1: SALES TRENDS ─── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="kirana-card p-6">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" /> Revenue Timeline
            </h3>
            {analytics.timelineData.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No sales data for the selected period.</p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.timelineData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toFixed(2)}`, 'Revenue']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontSize: '13px' }}
                    />
                    <Bar dataKey="total" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: PAYMENT MODES ─── */}
      {activeTab === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="kirana-card p-6 flex flex-col items-center">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2 self-start">
              <PieIcon className="h-5 w-5 text-emerald-500" /> Payment Mode Breakdown
            </h3>
            {analytics.paymentMethodsData.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No transactions recorded.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={analytics.paymentMethodsData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={95} 
                      paddingAngle={4}
                    >
                      {analytics.paymentMethodsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toFixed(2)}`, 'Amount']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="kirana-card p-6 space-y-4">
            <h3 className="text-base font-bold border-b pb-3">Collections Summary</h3>
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border flex justify-between items-center bg-emerald-500/5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    💵
                  </div>
                  <div>
                    <p className="font-bold text-sm">Cash In Hand</p>
                    <p className="text-xs text-muted-foreground">Collected across counter</p>
                  </div>
                </div>
                <p className="font-black text-emerald-600 text-lg">₹{analytics.cashTotal.toFixed(2)}</p>
              </div>

              <div className="p-3.5 rounded-xl border flex justify-between items-center bg-blue-500/5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    📱
                  </div>
                  <div>
                    <p className="font-bold text-sm">UPI / QR Payments</p>
                    <p className="text-xs text-muted-foreground">Settled into bank account</p>
                  </div>
                </div>
                <p className="font-black text-blue-600 text-lg">₹{analytics.upiTotal.toFixed(2)}</p>
              </div>

              <div className="p-3.5 rounded-xl border flex justify-between items-center bg-rose-500/5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                    📝
                  </div>
                  <div>
                    <p className="font-bold text-sm">Udhar (Market Credit)</p>
                    <p className="text-xs text-muted-foreground">Pending customer dues</p>
                  </div>
                </div>
                <p className="font-black text-rose-600 text-lg">₹{analytics.udharTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: CA-READY GSTR-1 TAX REPORT (Crucial) ─── */}
      {activeTab === 'gstr1' && (
        <div className="space-y-6">
          <div className="kirana-card p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  GSTR-1 Tax Rate Slab Summary
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  CA-Ready breakdown for Filing GSTR-1 / B2C (Small) Invoices
                </p>
              </div>
              <Button onClick={exportGSTR1CSV} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Export CA GSTR-1 Excel (CSV)
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b">
                  <tr>
                    <th className="px-5 py-3">Tax Slab</th>
                    <th className="px-5 py-3 text-right">Taxable Value (₹)</th>
                    <th className="px-5 py-3 text-right">CGST (₹)</th>
                    <th className="px-5 py-3 text-right">SGST (₹)</th>
                    <th className="px-5 py-3 text-right">Total Tax (₹)</th>
                    <th className="px-5 py-3 text-right">Total Invoice Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(gstr1Data).map(([slab, val]) => (
                    <tr key={slab} className="hover:bg-muted/30">
                      <td className="px-5 py-3.5 font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-muted font-mono">{slab}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium">₹{val.taxable.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground">₹{val.cgst.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground">₹{val.sgst.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        ₹{val.totalTax.toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-foreground">
                        ₹{val.invoiceTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: TOP PRODUCTS ─── */}
      {activeTab === 'products' && (
        <div className="kirana-card p-6">
          <h3 className="text-base font-bold mb-4">Top Revenue Generating Products</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3 text-center">Units Sold</th>
                  <th className="px-4 py-3 text-right">Total Revenue (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {analytics.topProducts.map((p, idx) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{p.qty}</td>
                    <td className="px-4 py-3 text-right font-black text-indigo-600 dark:text-indigo-400">
                      ₹{p.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 5: UDHAR AGING & OVERDUE ANALYSIS ─── */}
      {activeTab === 'udharAging' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="stat-card border-l-4 border-l-rose-500">
              <span className="stat-label text-xs">Total Pending Udhar</span>
              <div className="stat-value text-rose-600">₹{udharAging.totalOutstanding.toFixed(2)}</div>
              <p className="text-[11px] text-muted-foreground mt-1">All market credit</p>
            </div>
            <div className="stat-card border-l-4 border-l-emerald-500">
              <span className="stat-label text-xs">0 - 15 Days</span>
              <div className="stat-value text-emerald-600">₹{udharAging.overdue0to15.toFixed(2)}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Recent credit (safe)</p>
            </div>
            <div className="stat-card border-l-4 border-l-amber-500">
              <span className="stat-label text-xs">16 - 30 Days</span>
              <div className="stat-value text-amber-600">₹{udharAging.overdue16to30.toFixed(2)}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Follow-up needed</p>
            </div>
            <div className="stat-card border-l-4 border-l-red-600">
              <span className="stat-label text-xs">30+ Days (Overdue)</span>
              <div className="stat-value text-red-600">₹{udharAging.overdue30plus.toFixed(2)}</div>
              <p className="text-[11px] text-muted-foreground mt-1">High risk credit</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 6: 1-CLICK EXPORTS CENTER ─── */}
      {activeTab === 'exports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="kirana-card p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-base">CA-Ready GSTR-1 Summary</h4>
                <p className="text-xs text-muted-foreground">Official format for Chartered Accountants and GST filing</p>
              </div>
            </div>
            <Button onClick={exportGSTR1CSV} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              <Download className="h-4 w-4 mr-2" /> Download GSTR-1 CSV
            </Button>
          </div>

          <div className="kirana-card p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-base">Detailed Sales Register</h4>
                <p className="text-xs text-muted-foreground">Itemized transaction log with payment methods</p>
              </div>
            </div>
            <Button onClick={exportSalesRegisterCSV} className="w-full font-bold">
              <Download className="h-4 w-4 mr-2" /> Download Sales Register CSV
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
