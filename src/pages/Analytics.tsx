import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Clock, AlertTriangle, ShoppingBag, 
  IndianRupee, CreditCard, Banknote, Smartphone,
  Users, BarChart3, Sparkles,
  ArrowUpRight, Flame, RefreshCw, Calendar
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import type { Transaction, Product, Customer } from '../types';

export default function Analytics() {
  const { shopData } = useAuth();
  const [sales, setSales] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  // Default to 30 days (1-month limit to keep queries lightweight)
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days' | 'customMonth' | 'all'>('30days');
  const [customMonth, setCustomMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txList, prodList, custList] = await Promise.all([
        api.transactions.list(),
        api.products.list(),
        api.customers.list()
      ]);
      setSales(Array.isArray(txList) ? txList : []);
      setProducts(Array.isArray(prodList) ? prodList : []);
      setCustomers(Array.isArray(custList) ? custList : []);
    } catch (err: any) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [shopData?.shopId]);

  // Robust date parser
  const parseDate = (dVal: any): Date | null => {
    if (!dVal) return null;
    if (dVal instanceof Date) return isNaN(dVal.getTime()) ? null : dVal;
    let s = String(dVal).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s) && !s.includes('Z') && !s.includes('+')) {
      s = s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  // Filter sales by time range
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return sales.filter(s => {
      if (!s.createdAt) return false;
      const d = parseDate(s.createdAt);
      if (!d) return true;

      if (timeRange === 'today') return d >= todayStart;
      if (timeRange === '7days') return d >= sevenDaysAgo;
      if (timeRange === '30days') return d >= thirtyDaysAgo;
      if (timeRange === 'customMonth' && customMonth) {
        const [y, m] = customMonth.split('-').map(Number);
        return d.getFullYear() === y && d.getMonth() === (m - 1);
      }
      return true; // all
    });
  }, [sales, timeRange, customMonth]);

  // 1. Financial Overview (Revenue, COGS, Net Profit, Margin)
  const financials = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const prodMap = new Map<string, Product>();
    products.forEach(p => prodMap.set(p.id, p));

    filteredSales.forEach(bill => {
      totalRevenue += Number(bill.totalAmount) || 0;
      totalTax += Number(bill.taxAmount) || 0;
      totalDiscount += Number(bill.discountAmount) || 0;

      (bill.items || []).forEach(it => {
        const prod = prodMap.get(it.id);
        const pp = it.purchasePrice || prod?.purchasePrice || 0;
        totalCost += (Number(pp) || 0) * (Number(it.qty) || 1);
      });
    });

    const netProfit = Math.max(0, totalRevenue - totalCost);
    const marginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const avgTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

    return {
      revenue: totalRevenue,
      cost: totalCost,
      tax: totalTax,
      discount: totalDiscount,
      netProfit,
      marginPercent,
      avgTicket,
      totalBills: filteredSales.length
    };
  }, [filteredSales, products]);

  // 2. Hourly Velocity (Peak Shopping Hours)
  const hourlyData = useMemo(() => {
    const counts = new Array(24).fill(0);
    const revenues = new Array(24).fill(0);

    filteredSales.forEach(s => {
      const d = parseDate(s.createdAt);
      if (d) {
        const hr = d.getHours();
        counts[hr] += 1;
        revenues[hr] += Number(s.totalAmount) || 0;
      }
    });

    return Array.from({ length: 16 }, (_, i) => {
      const hr = i + 7; // 7 AM to 10 PM
      const label = hr < 12 ? `${hr} AM` : hr === 12 ? '12 PM' : `${hr - 12} PM`;
      return {
        hour: hr,
        label,
        orders: counts[hr] || 0,
        revenue: revenues[hr] || 0
      };
    });
  }, [filteredSales]);

  // Identify Peak Hour
  const peakHour = useMemo(() => {
    let max = { hour: 0, label: '—', orders: 0, revenue: 0 };
    hourlyData.forEach(h => {
      if (h.orders > max.orders) {
        max = h;
      }
    });
    return max;
  }, [hourlyData]);

  // 3. Top Selling Products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    filteredSales.forEach(s => {
      (s.items || []).forEach(it => {
        const existing = map.get(it.id) || { name: it.name, qty: 0, revenue: 0 };
        existing.qty += Number(it.qty) || 1;
        existing.revenue += (Number(it.sellingPrice) || 0) * (Number(it.qty) || 1);
        map.set(it.id, existing);
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [filteredSales]);

  // 4. Dead Stock / Slow Moving Inventory Alert
  const deadStock = useMemo(() => {
    const soldProductIds = new Set<string>();
    filteredSales.forEach(s => {
      (s.items || []).forEach(it => soldProductIds.add(it.id));
    });

    const unsold = products
      .filter(p => !soldProductIds.has(p.id) && (Number(p.stock) || 0) > 0)
      .map(p => ({
        ...p,
        lockedValue: (Number(p.purchasePrice) || Number(p.sellingPrice) || 0) * (Number(p.stock) || 0)
      }))
      .sort((a, b) => b.lockedValue - a.lockedValue);

    const totalLockedCapital = unsold.reduce((sum, p) => sum + p.lockedValue, 0);

    return {
      items: unsold.slice(0, 10),
      totalCount: unsold.length,
      totalLockedCapital
    };
  }, [filteredSales, products]);

  // 5. Payment Methods Distribution
  const paymentData = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let udhar = 0;

    filteredSales.forEach(b => {
      const amt = Number(b.totalAmount) || 0;
      if (b.paymentMethod === 'cash') cash += amt;
      else if (b.paymentMethod === 'upi') upi += amt;
      else if (b.paymentMethod === 'udhar') udhar += amt;
    });

    return [
      { name: '💵 Cash', value: cash, color: '#10b981' },
      { name: '📱 UPI / QR', value: upi, color: '#6366f1' },
      { name: '📕 Credit (Udhar)', value: udhar, color: '#f43f5e' }
    ].filter(p => p.value > 0);
  }, [filteredSales]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-500" /> Digital Analytics & Business Insights
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Store velocity, peak shopping hours, gross profit margins, and inventory performance.
          </p>
        </div>

        {/* Time Range Pills */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1.5 rounded-2xl border border-border flex-wrap">
          {[
            { id: '30days', label: 'Last 30 Days' },
            { id: '7days', label: 'Last 7 Days' },
            { id: 'today', label: 'Today' },
            { id: 'all', label: 'All Time' }
          ].map(pill => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setTimeRange(pill.id as any)}
              className={`text-xs px-3 py-1 rounded-xl transition-all font-semibold ${
                timeRange === pill.id
                  ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {pill.label}
            </button>
          ))}

          {/* Month Calendar Picker */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border transition-all ${
            timeRange === 'customMonth'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
              : 'bg-card text-muted-foreground hover:text-foreground border-border'
          }`}>
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-bold shrink-0">Month:</span>
            <input
              type="month"
              value={customMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setCustomMonth(e.target.value);
                  setTimeRange('customMonth');
                }
              }}
              className="bg-transparent border-none text-xs font-bold cursor-pointer focus:outline-none focus:ring-0 p-0 text-inherit font-mono"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <IndianRupee className="h-4 w-4 text-emerald-500" /> Total Revenue
          </p>
          <p className="text-2xl font-black text-foreground mt-1">
            ₹{financials.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Total {financials.totalBills} invoices
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-purple-500" /> Gross Profit
          </p>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            ₹{financials.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3" /> {financials.marginPercent.toFixed(1)}% Profit Margin
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <ShoppingBag className="h-4 w-4 text-blue-500" /> Average Basket Value
          </p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            ₹{financials.avgTicket.toFixed(0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Per customer purchase</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-amber-500" /> Peak Shopping Hour
          </p>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 truncate">
            {peakHour.orders > 0 ? `${peakHour.label}` : 'No Data'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {peakHour.orders > 0 ? `${peakHour.orders} invoices recorded` : '—'}
          </p>
        </div>
      </div>

      {/* Peak Business Hours Bar Chart */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-500" /> Hourly Store Velocity (Peak Hours)
            </h3>
            <p className="text-xs text-muted-foreground">
              Customer volume breakdown between 7:00 AM and 10:00 PM to help plan staff shifts.
            </p>
          </div>
          {peakHour.orders > 0 && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300">
              ⚡ Peak Traffic: {peakHour.label} ({peakHour.orders} bills)
            </span>
          )}
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} stroke="#888" />
              <YAxis fontSize={11} stroke="#888" />
              <Tooltip 
                formatter={(val: any, name: string) => [
                  name === 'orders' ? `${val} bills` : `₹${Number(val).toFixed(0)}`,
                  name === 'orders' ? 'Customer Bills' : 'Sales Revenue'
                ]}
                contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="orders" fill="#f59e0b" radius={[6, 6, 0, 0]} name="orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column Layout: Dead Stock Alert + Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dead Stock / Slow Moving Inventory Alert */}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/10 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-rose-500/20">
            <div>
              <h3 className="text-base font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" /> Slow Moving / Dead Stock Alert
              </h3>
              <p className="text-xs text-muted-foreground">
                Products with zero sales during the selected period.
              </p>
            </div>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-500 text-white">
              {deadStock.totalCount} items
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-card border border-rose-200 dark:border-rose-800 text-xs flex items-center justify-between">
            <span className="text-muted-foreground font-semibold">Locked Capital in Idle Stock:</span>
            <span className="font-black text-rose-600 dark:text-rose-400 text-base">
              ₹{deadStock.totalLockedCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {deadStock.items.length === 0 ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center py-4 font-semibold">
                Great job! All inventory is moving actively. Zero dead stock detected. 🎉
              </p>
            ) : (
              deadStock.items.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-white dark:bg-card text-xs">
                  <div>
                    <p className="font-bold text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.category || 'General'} • Available Stock: {p.stock} {p.unit}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-rose-600 dark:text-rose-400">₹{p.lockedValue.toFixed(0)}</span>
                    <span className="block text-[10px] text-muted-foreground">locked</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="text-[11px] text-rose-700 dark:text-rose-300">
            💡 <strong>Action Tip:</strong> Consider running a 5% to 10% discount promotion to clear idle stock and release capital!
          </p>
        </div>

        {/* Top Selling Products */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" /> Top Velocity Products
              </h3>
              <p className="text-xs text-muted-foreground">Highest performing items by volume and revenue.</p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {topProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No sales data recorded yet.</p>
            ) : (
              topProducts.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border bg-background hover:bg-muted/40 transition-colors text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-xs shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-foreground">{it.name}</p>
                      <p className="text-[10px] text-muted-foreground">{it.qty} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      ₹{it.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Payment Modes Distribution */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-indigo-500" /> Payment Methods Breakdown
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {paymentData.map((pm, idx) => {
            const pct = financials.revenue > 0 ? ((pm.value / financials.revenue) * 100).toFixed(1) : '0';
            return (
              <div key={idx} className="p-4 rounded-xl border bg-muted/20 space-y-1">
                <p className="text-xs font-bold text-foreground">{pm.name}</p>
                <p className="text-xl font-black text-foreground">₹{pm.value.toLocaleString('en-IN')}</p>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden mt-2">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pm.color }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{pct}% of total sales</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
