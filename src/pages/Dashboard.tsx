import { useState, useEffect, useCallback } from 'react';
import { 
  IndianRupee, ShoppingCart, TrendingUp, Users, Wallet,
  AlertTriangle, Download, Sparkles, RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product, Transaction, Expense, Customer } from '../types';

export default function Dashboard() {
  const { shopData } = useAuth();
  
  const [todaysSales, setTodaysSales] = useState(0);
  const [todaysExpenses, setTodaysExpenses] = useState(0);
  const [todaysOrders, setTodaysOrders] = useState(0);
  const [last24hSales, setLast24hSales] = useState(0);
  const [last24hOrders, setLast24hOrders] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalUdhar, setTotalUdhar] = useState(0);
  const [udharCustomersCount, setUdharCustomersCount] = useState(0);
  const [newCustomersToday, setNewCustomersToday] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const parseDate = useCallback((dateVal: any): Date | null => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    let str = String(dateVal).trim();
    // Normalize naive SQLite/MySQL UTC datetime string (e.g. '2026-09-27 19:46:50') to ISO UTC with 'Z'
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(str) && !str.includes('Z') && !str.includes('+')) {
      str = str.replace(' ', 'T') + 'Z';
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }, []);

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const isToday = (dateVal: any) => {
        const d = parseDate(dateVal);
        if (!d) return false;
        return d.getFullYear() === now.getFullYear() &&
               d.getMonth() === now.getMonth() &&
               d.getDate() === now.getDate();
      };

      const isRecent24h = (dateVal: any) => {
        const d = parseDate(dateVal);
        if (!d) return false;
        return d >= twentyFourHoursAgo && d <= now;
      };
      
      const [rawProducts, rawTransactions, rawExpenses, rawCustomers] = await Promise.all([
        api.products.list(),
        api.transactions.list(),
        api.expenses.list(),
        api.customers.list()
      ]);

      const products: Product[] = Array.isArray(rawProducts) ? rawProducts : [];
      const transactions: Transaction[] = Array.isArray(rawTransactions) ? rawTransactions : [];
      const expenses: Expense[] = Array.isArray(rawExpenses) ? rawExpenses : [];
      const customers: Customer[] = Array.isArray(rawCustomers) ? rawCustomers : [];

      // Products & Low Stock
      setAllProducts(products);
      const lowStock = products.filter((p: Product) => p.stock <= (p.minStock || 5));
      setLowStockItems(lowStock.sort((a: Product, b: Product) => a.stock - b.stock));

      // Sales & Orders
      let salesTotal = 0;
      let orderCount = 0;
      let recentSales = 0;
      let recentOrders = 0;

      transactions.forEach((t: Transaction) => {
        const amount = Number(t.totalAmount) || 0;
        if (isToday(t.createdAt)) {
          salesTotal += amount;
          orderCount++;
        }
        if (isRecent24h(t.createdAt)) {
          recentSales += amount;
          recentOrders++;
        }
      });

      setTodaysSales(salesTotal);
      setTodaysOrders(orderCount);
      setLast24hSales(recentSales);
      setLast24hOrders(recentOrders);

      // Expenses (Today)
      let expensesTotal = 0;
      expenses.forEach((e: Expense) => {
        if (isToday(e.date || e.createdAt)) {
          expensesTotal += Number(e.amount) || 0;
        }
      });
      setTodaysExpenses(expensesTotal);

      // Customers & Udhar
      let udharTotal = 0;
      let udharCustCount = 0;
      let newCustCount = 0;
      customers.forEach((c: Customer) => {
        if (Number(c.balance) > 0) {
          udharTotal += Number(c.balance);
          udharCustCount++;
        }
        if (isToday(c.createdAt)) {
          newCustCount++;
        }
      });
      setTotalCustomers(customers.length);
      setTotalUdhar(udharTotal);
      setUdharCustomersCount(udharCustCount);
      setNewCustomersToday(newCustCount);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [shopData?.shopId, parseDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleExportCSV = async () => {
    try {
      const data = [
        ['Metric', 'Value'],
        ['Total Sales Today', todaysSales.toFixed(2)],
        ['Total Orders Today', todaysOrders],
        ['Total Expenses Today', todaysExpenses.toFixed(2)],
        ['Total Customers', totalCustomers],
        ['Total Udhar', totalUdhar.toFixed(2)],
        ['Udhar Customers', udharCustomersCount],
        ['New Customers Today', newCustomersToday]
      ];
      
      const csvContent = data.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `dashboard_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export data');
    }
  };

  const getAIInsights = () => {
    const restockItems = allProducts.filter(p => p.stock <= (p.minStock || 5)).slice(0, 3);
    const trendingItems = [...allProducts].sort((a, b) => (b.sellingPrice || 0) - (a.sellingPrice || 0)).slice(0, 2);
    
    // Find expiring items (within next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringItems = allProducts.filter(p => {
      if (!p.expiryDate) return false;
      const expiry = new Date(p.expiryDate);
      return expiry <= thirtyDaysFromNow && expiry >= new Date();
    }).slice(0, 3);

    return { restockItems, trendingItems, expiringItems };
  };

  const aiInsights = getAIInsights();

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Today's store overview at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            title="नवीन डेटा रिफ्रेश करा"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>रिफ्रेश</span>
          </button>
          <button
            id="export-btn"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" /> Export Report
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Today's Sales</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <IndianRupee className="h-4 w-4 text-indigo-500" />
            </div>
          </div>
          <div className="stat-value text-indigo-600">₹{todaysSales.toFixed(2)}</div>
          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
            <span>Total revenue today</span>
            {last24hSales > todaysSales && (
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800" title="मागील २४ तासांतील एकूण विक्री">
                २४h: ₹{last24hSales.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Today's Expenses</span>
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <div className="stat-value text-red-500">₹{todaysExpenses.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground mt-1">Costs incurred today</p>
        </div>

        <div className="stat-card border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Net Profit</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <div className={`stat-value ${todaysSales - todaysExpenses >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            ₹{(todaysSales - todaysExpenses).toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Sales minus Expenses</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Today's Orders</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="stat-value">{todaysOrders}</div>
          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
            <span>Bills generated</span>
            {last24hOrders > todaysOrders && (
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800" title="मागील २४ तासांतील एकूण ऑर्डर्स">
                २४h: {last24hOrders} बिल
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AI & Udhar Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="kirana-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI Smart Assistant
            </h2>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> Restock Urgently
              </h4>
              {aiInsights.restockItems.length > 0 ? (
                <ul className="space-y-1">
                  {aiInsights.restockItems.map(p => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                      <span className="text-foreground">{p.name}</span>
                      <span className="ml-auto text-xs badge badge-danger">{p.stock} left</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-600">✓ Stock levels look good!</p>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Top Value Items
              </h4>
              {aiInsights.trendingItems.length > 0 ? (
                <ul className="space-y-1">
                  {aiInsights.trendingItems.map(p => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-foreground">{p.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">₹{Number(p.sellingPrice || 0).toFixed(0)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Add products to see insights.</p>
              )}
            </div>

            {aiInsights.expiringItems.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Expiring Soon
                </h4>
                <ul className="space-y-1">
                  {aiInsights.expiringItems.map(p => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="text-foreground">{p.name}</span>
                      <span className="ml-auto badge badge-danger">{new Date(p.expiryDate!).toLocaleDateString('en-IN')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="kirana-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-rose-500" /> Udhar Overview
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Pending Udhar</p>
              <p className="text-3xl font-bold text-rose-500">₹{totalUdhar.toFixed(2)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Customers in Udhar</p>
                <p className="text-xl font-bold text-foreground">{udharCustomersCount}</p>
              </div>
              <div className="rounded-xl bg-muted/50 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-0.5">New Today</p>
                <p className="text-xl font-bold text-emerald-600">+{newCustomersToday}</p>
              </div>
            </div>
            <div className="rounded-xl bg-muted/50 border border-border p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Total Customers</p>
              <p className="text-xl font-bold text-foreground">{totalCustomers}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
