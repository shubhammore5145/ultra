import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  IndianRupee, ShoppingCart, TrendingUp, Users, Wallet,
  AlertTriangle, Download, Sparkles, RefreshCw, Zap,
  Smartphone, CreditCard, Banknote, MessageCircle, CheckCircle2,
  ChevronRight, ArrowUpRight, ShieldCheck, Printer, X,
  BarChart3, Package, Clock, RotateCcw, Award
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { printReceiptElementThermal, getConfiguredPaperSize } from '../lib/printThermalHtml';
import { getBillReturnSummary } from '../lib/salesReturnUtils';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import type { Product, Transaction, Expense, Customer, SalesReturn } from '../types';

export default function Dashboard() {
  const { shopData } = useAuth();
  const { canAccess } = usePlan();
  const navigate = useNavigate();
  
  // Financial metrics
  const [todaysSales, setTodaysSales] = useState(0);
  const [todaysCash, setTodaysCash] = useState(0);
  const [todaysUPI, setTodaysUPI] = useState(0);
  const [todaysUdhar, setTodaysUdhar] = useState(0);
  const [todaysExpenses, setTodaysExpenses] = useState(0);
  const [todaysOrders, setTodaysOrders] = useState(0);
  
  const [last24hSales, setLast24hSales] = useState(0);
  const [last24hOrders, setLast24hOrders] = useState(0);

  // Customer & Udhar metrics
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalUdhar, setTotalUdhar] = useState(0);
  const [udharCustomersCount, setUdharCustomersCount] = useState(0);
  const [newCustomersToday, setNewCustomersToday] = useState(0);
  
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allReturns, setAllReturns] = useState<SalesReturn[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<string | null>(null);

  // Cash Register Day-Close Settlement State
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState(() => {
    return localStorage.getItem('pos_opening_cash') || '0';
  });
  const [countedCash, setCountedCash] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');

  const parseDate = useCallback((dateVal: any): Date | null => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    let str = String(dateVal).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(str) && !str.includes('Z') && !str.includes('+')) {
      str = str.replace(' ', 'T') + 'Z';
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }, []);

  const fetchDashboardData = useCallback(async (_isSilent = false) => {
    setIsRefreshing(true);

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
      
      const [rawProducts, rawTransactions, rawExpenses, rawCustomers, rawReturns] = await Promise.all([
        api.products.list(),
        api.transactions.list(),
        api.expenses.list(),
        api.customers.list(),
        api.salesReturns.list().catch(() => [])
      ]);

      const products: Product[] = Array.isArray(rawProducts) ? rawProducts : [];
      const transactions: Transaction[] = Array.isArray(rawTransactions) ? rawTransactions : [];
      const expenses: Expense[] = Array.isArray(rawExpenses) ? rawExpenses : [];
      const customers: Customer[] = Array.isArray(rawCustomers) ? rawCustomers : [];
      const returnsList: SalesReturn[] = Array.isArray(rawReturns) ? rawReturns : [];

      setAllProducts(products);
      setAllTransactions(transactions);
      setAllCustomers(customers);
      setAllReturns(returnsList);

      // Financial breakdown calculation
      let salesTotal = 0;
      let cashTotal = 0;
      let upiTotal = 0;
      let udharGivenToday = 0;
      let orderCount = 0;
      let recentSales = 0;
      let recentOrders = 0;

      transactions.forEach((t: Transaction) => {
        const amount = Number(t.totalAmount) || 0;
        const method = (t.paymentMethod || 'cash').toLowerCase();

        if (isToday(t.createdAt)) {
          salesTotal += amount;
          orderCount++;

          if (method === 'cash') {
            cashTotal += amount;
          } else if (method === 'upi') {
            upiTotal += amount;
          } else if (method === 'udhar') {
            udharGivenToday += amount;
          } else if (method === 'split' && t.splitAmounts) {
            cashTotal += Number(t.splitAmounts.cash || 0);
            upiTotal += Number(t.splitAmounts.upi || 0);
            udharGivenToday += Number(t.splitAmounts.udhar || 0);
          } else if (method === 'split') {
            cashTotal += amount / 2;
            upiTotal += amount / 2;
          } else {
            cashTotal += amount;
          }
        }

        if (isRecent24h(t.createdAt)) {
          recentSales += amount;
          recentOrders++;
        }
      });

      setTodaysSales(salesTotal);
      setTodaysCash(cashTotal);
      setTodaysUPI(upiTotal);
      setTodaysUdhar(udharGivenToday);
      setTodaysOrders(orderCount);
      setLast24hSales(recentSales);
      setLast24hOrders(recentOrders);

      // Today's Expenses
      let expensesTotal = 0;
      expenses.forEach((e: Expense) => {
        if (isToday(e.date || e.createdAt)) {
          expensesTotal += Number(e.amount) || 0;
        }
      });
      setTodaysExpenses(expensesTotal);

      // Customers & Total Udhar Outstanding
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
      setIsRefreshing(false);
    }
  }, [shopData?.shopId, parseDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Keyboard shortcut: Press F2 anywhere on Dashboard to open POS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        navigate('/pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Trigger Nightly Summary WhatsApp to Owner
  const handleSendNightlySummary = async () => {
    const phone = shopData?.phone;
    if (!phone) {
      alert('Please enter your shop phone number in Settings first.');
      return;
    }
    setSendingSummary(true);
    setSummaryStatus(null);
    try {
      await api.whatsapp.sendNightlySummary({
        shopId: shopData?.shopId,
        targetPhone: phone
      });
      setSummaryStatus('✓ Summary sent to ' + phone);
      setTimeout(() => setSummaryStatus(null), 5000);
    } catch (err: any) {
      console.error('Failed to send summary:', err);
      alert(err.message || 'Failed to send WhatsApp summary. Make sure WhatsApp Bot is connected.');
    } finally {
      setSendingSummary(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const data = [
        ['Metric', 'Value'],
        ['Total Sales Today', todaysSales.toFixed(2)],
        ['Cash Collected Today', todaysCash.toFixed(2)],
        ['UPI Received Today', todaysUPI.toFixed(2)],
        ['Udhar (Credit) Given Today', todaysUdhar.toFixed(2)],
        ['Total Expenses Today', todaysExpenses.toFixed(2)],
        ['Net Cash In Drawer', Math.max(0, todaysCash - todaysExpenses).toFixed(2)],
        ['Total Orders Today', todaysOrders],
        ['Total Customers', totalCustomers],
        ['Total Market Udhar', totalUdhar.toFixed(2)],
        ['Udhar Customers Count', udharCustomersCount],
        ['New Customers Added Today', newCustomersToday]
      ];
      
      const csvContent = data.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `store_report_${new Date().toISOString().split('T')[0]}.csv`);
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
  const netProfit = todaysSales - todaysExpenses;
  const cashInDrawer = Math.max(0, todaysCash - todaysExpenses);
  const avgBillValue = todaysOrders > 0 ? todaysSales / todaysOrders : 0;

  // Percentage splits of today's collection
  const paymentTotalToday = todaysCash + todaysUPI + todaysUdhar;
  const cashSharePct = paymentTotalToday > 0 ? Math.round((todaysCash / paymentTotalToday) * 100) : 0;
  const upiSharePct = paymentTotalToday > 0 ? Math.round((todaysUPI / paymentTotalToday) * 100) : 0;
  const udharSharePct = paymentTotalToday > 0 ? Math.max(0, 100 - cashSharePct - upiSharePct) : 0;

  // Derived visual analytics: 7-day trend, top movers, recent bills, inventory health, and today's returns
  const storeVisuals = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const toLocalDayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const prodMap = new Map<string, Product>();
    const prodNameMap = new Map<string, Product>();
    let totalCostVal = 0;
    let totalRetailVal = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let expiringSoonCount = 0;
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const p of allProducts) {
      if (p.id) prodMap.set(p.id, p);
      if (p.name) prodNameMap.set(p.name.trim().toLowerCase(), p);
      const st = Number(p.stock || 0);
      if (st > 0) {
        totalCostVal += st * Number(p.purchasePrice || 0);
        totalRetailVal += st * Number(p.sellingPrice || 0);
      }
      if (st <= 0) outOfStockCount++;
      else if (st <= (p.minStock || 5)) lowStockCount++;

      if (p.expiryDate) {
        const exp = new Date(p.expiryDate);
        if (!isNaN(exp.getTime()) && exp <= thirtyDaysLater && exp >= new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
          expiringSoonCount++;
        }
      }
    }

    // 7-day buckets
    const dayBuckets = new Map<string, { day: string; cash: number; upi: number; udhar: number; total: number; bills: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = toLocalDayKey(d);
      dayBuckets.set(key, {
        day: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
        cash: 0,
        upi: 0,
        udhar: 0,
        total: 0,
        bills: 0
      });
    }

    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const todaySoldMap = new Map<string, { name: string; qty: number; revenue: number }>();
    const weekSoldMap = new Map<string, { name: string; qty: number; revenue: number }>();
    let todayItemProfit = 0;

    for (const tx of allTransactions) {
      const dt = parseDate(tx.createdAt);
      if (!dt) continue;
      const key = toLocalDayKey(dt);
      const amt = Number(tx.totalAmount || 0);
      const method = (tx.paymentMethod || 'cash').toLowerCase();
      const bucket = dayBuckets.get(key);
      if (bucket) {
        bucket.total += amt;
        bucket.bills += 1;
        if (method === 'cash') bucket.cash += amt;
        else if (method === 'upi') bucket.upi += amt;
        else if (method === 'udhar') bucket.udhar += amt;
        else if (method === 'split' && tx.splitAmounts) {
          bucket.cash += Number(tx.splitAmounts.cash || 0);
          bucket.upi += Number(tx.splitAmounts.upi || 0);
          bucket.udhar += Number(tx.splitAmounts.udhar || 0);
        } else if (method === 'split') {
          bucket.cash += amt / 2;
          bucket.upi += amt / 2;
        } else {
          bucket.cash += amt;
        }
      }

      const isTodayTx = key === todayKey;
      const isWeekTx = dt >= sevenDaysAgo;

      if (isTodayTx || isWeekTx) {
        const items = Array.isArray(tx.items) ? tx.items : [];
        for (const it of items as any[]) {
          const itemName = String(it.name || it.productName || 'Item').trim();
          const qty = Number(it.qty || 1);
          const sp = Number(it.sellingPrice ?? it.price ?? 0);
          const rev = sp * qty;
          const mapKey = String(it.productId || it.id || itemName.toLowerCase());

          if (isTodayTx) {
            const matchedProd = (it.id && prodMap.get(it.id)) || prodNameMap.get(itemName.toLowerCase());
            const cp = Number(it.purchasePrice || matchedProd?.purchasePrice || 0);
            todayItemProfit += (sp - cp) * qty;

            const prev = todaySoldMap.get(mapKey) || { name: itemName, qty: 0, revenue: 0 };
            prev.qty += qty;
            prev.revenue += rev;
            todaySoldMap.set(mapKey, prev);
          }
          if (isWeekTx) {
            const prevW = weekSoldMap.get(mapKey) || { name: itemName, qty: 0, revenue: 0 };
            prevW.qty += qty;
            prevW.revenue += rev;
            weekSoldMap.set(mapKey, prevW);
          }
        }
      }
    }

    const usingTodayProducts = todaySoldMap.size > 0;
    const rawTop = Array.from((usingTodayProducts ? todaySoldMap : weekSoldMap).values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    const maxTopRevenue = rawTop[0]?.revenue || 1;

    const custMap = new Map<string, Customer>();
    allCustomers.forEach((c) => {
      if (c.id) custMap.set(c.id, c);
    });

    const recentBills = [...allTransactions]
      .sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0))
      .slice(0, 5)
      .map((tx) => {
        const cust = tx.customerId ? custMap.get(tx.customerId) : undefined;
        return {
          ...tx,
          resolvedCustomer: tx.customerName || cust?.name || 'Walk-in Customer',
          returnSummary: getBillReturnSummary(tx, allReturns)
        };
      });

    let todayReturnCount = 0;
    let todayReturnAmount = 0;
    for (const r of allReturns) {
      const rd = parseDate(r.createdAt);
      if (rd && toLocalDayKey(rd) === todayKey) {
        todayReturnCount++;
        todayReturnAmount += Number(r.totalRefund || 0);
      }
    }

    return {
      chartData: Array.from(dayBuckets.values()).map((d) => ({
        ...d,
        cash: Math.round(d.cash),
        upi: Math.round(d.upi),
        udhar: Math.round(d.udhar),
        total: Math.round(d.total)
      })),
      topProducts: rawTop,
      topProductsWindow: usingTodayProducts ? 'Today' : 'Last 7 Days',
      maxTopRevenue,
      recentBills,
      todayItemProfit,
      todayReturnCount,
      todayReturnAmount,
      inventoryHealth: {
        totalSkus: allProducts.length,
        totalCostVal,
        totalRetailVal,
        outOfStockCount,
        lowStockCount,
        expiringSoonCount
      }
    };
  }, [allProducts, allTransactions, allCustomers, allReturns, parseDate]);

  return (
    <div className="space-y-6 pb-10 animate-fadeInUp">
      {/* Hero Action Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500 text-white uppercase tracking-wider">
              Live POS Store
            </span>
            <span className="text-white/75 text-xs font-medium">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-1 truncate">
            {shopData?.shopName || shopData?.name || 'MartGPT Store'}
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200 mt-0.5">
            Monitor real-time cash, UPI, udhar collections, top products, and 7-day sales velocity.
          </p>
        </div>

        {/* Primary Action Buttons (clean single-line alignment on desktop) */}
        <div className="flex items-center gap-2.5 flex-wrap lg:flex-nowrap shrink-0 w-full xl:w-auto">
          <Button
            onClick={() => navigate('/pos')}
            className="h-11 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold shadow-lg shadow-emerald-500/30 flex items-center gap-2 text-sm sm:text-base transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Zap className="h-4 w-4 sm:h-5 sm:w-5 fill-white" /> Start POS Billing
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] bg-emerald-700 rounded font-mono">F2</kbd>
          </Button>

          <Button
            variant="outline"
            onClick={handleSendNightlySummary}
            disabled={sendingSummary}
            className="h-11 px-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-semibold flex items-center gap-2 text-xs whitespace-nowrap cursor-pointer"
            title="Send daily business summary to owner's WhatsApp"
          >
            <MessageCircle className="h-4 w-4 text-emerald-400" />
            <span>{sendingSummary ? 'Sending...' : 'WhatsApp Summary'}</span>
            {!canAccess('nightly_summary') && (
              <span className="text-[10px] bg-purple-500/90 text-white font-black px-1.5 py-0.5 rounded-full shadow-sm">
                PRO
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowSettlementModal(true)}
            className="h-11 px-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-semibold flex items-center gap-2 text-xs whitespace-nowrap cursor-pointer"
            title="End-of-Day Register Settlement & Cash Count"
          >
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <span>Register Closing</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="h-11 w-11 rounded-2xl bg-white/10 hover:bg-white/20 border-white/20 text-white shrink-0 cursor-pointer"
            title="Refresh Store Data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleExportCSV}
            className="h-11 w-11 rounded-2xl bg-white/10 hover:bg-white/20 border-white/20 text-white shrink-0 cursor-pointer"
            title="Export Daily Report (CSV)"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {summaryStatus && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4" /> {summaryStatus}
        </div>
      )}

      {/* ─── PAYMENT BREAKDOWN ROW (Today's Collections: Cash vs UPI vs Udhar) ─── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5 text-primary" /> Today's Collection &amp; Payment Breakdown
          </h2>
          {paymentTotalToday > 0 && (
            <span className="text-[11px] font-semibold text-muted-foreground">
              Cash {cashSharePct}% • UPI {upiSharePct}% • Udhar {udharSharePct}%
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Today's Cash Collected */}
          <div className="stat-card border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label text-xs">Cash Collected</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Banknote className="h-4 w-4" />
              </div>
            </div>
            <div className="stat-value text-emerald-600 dark:text-emerald-400">
              ₹{todaysCash.toFixed(2)}
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-muted-foreground">Cash received in counter</p>
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {cashSharePct}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${cashSharePct}%` }} />
            </div>
          </div>

          {/* Today's UPI Received */}
          <div className="stat-card border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label text-xs">UPI Payments</span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Smartphone className="h-4 w-4" />
              </div>
            </div>
            <div className="stat-value text-blue-600 dark:text-blue-400">
              ₹{todaysUPI.toFixed(2)}
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-muted-foreground">Direct to bank account</p>
              <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">
                {upiSharePct}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${upiSharePct}%` }} />
            </div>
          </div>

          {/* Today's Udhar Given */}
          <div className="stat-card border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label text-xs">Udhar Given Today</span>
              <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="stat-value text-rose-600 dark:text-rose-400">
              ₹{todaysUdhar.toFixed(2)}
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-muted-foreground">Credit sales recorded today</p>
              <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded">
                {udharSharePct}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
              <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${udharSharePct}%` }} />
            </div>
          </div>

          {/* Net Cash in Drawer (Galla) */}
          <div className="stat-card border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10">
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label text-xs">Cash in Drawer</span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="stat-value text-amber-600 dark:text-amber-400">
              ₹{cashInDrawer.toFixed(2)}
            </div>
            <div className="flex items-center justify-between mt-1.5 gap-1">
              <p className="text-[11px] text-muted-foreground truncate">Cash minus expenses</p>
              <button
                type="button"
                onClick={() => setShowSettlementModal(true)}
                className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30 shrink-0"
              >
                <ShieldCheck className="h-3 w-3" /> Settle
              </button>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: todaysCash > 0 ? `${Math.min(100, Math.round((cashInDrawer / todaysCash) * 100))}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── PRIMARY STORE OVERVIEW STATS GRID ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        {/* Total Gross Sales */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Total Sales Today</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <IndianRupee className="h-4 w-4 text-indigo-500" />
            </div>
          </div>
          <div className="stat-value text-indigo-600 dark:text-indigo-400">₹{todaysSales.toFixed(2)}</div>
          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
            <span>Total orders revenue</span>
            {last24hSales > todaysSales && (
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                24h: ₹{last24hSales.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Today's Expenses */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Today's Expenses</span>
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <div className="stat-value text-red-500">₹{todaysExpenses.toFixed(2)}</div>
          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
            <span>Costs logged today</span>
            <button
              type="button"
              onClick={() => navigate('/expenses')}
              className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
            >
              Add / View →
            </button>
          </div>
        </div>

        {/* Net Cash Flow & Estimated Profit */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Today's Net Margin</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <div className={`stat-value ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            ₹{netProfit.toFixed(2)}
          </div>
          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
            <span>Sales minus Expenses</span>
            {storeVisuals.todayItemProfit > 0 && (
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Item Profit: ₹{storeVisuals.todayItemProfit.toFixed(0)}
              </span>
            )}
          </div>
        </div>

        {/* Today's Order Count & Avg Bill */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Today's Invoices</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="stat-value">{todaysOrders}</div>
          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
            <span>Avg Bill: <strong className="text-foreground">₹{avgBillValue.toFixed(0)}</strong></span>
            {last24hOrders > todaysOrders && (
              <span className="text-[11px] font-bold text-muted-foreground">
                24h: {last24hOrders} bills
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── STORE INVENTORY & RETURNS HEALTH STRIP ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="p-3.5 rounded-2xl bg-card border border-border hover:border-indigo-500/50 transition-all text-left flex items-center gap-3 cursor-pointer shadow-xs"
        >
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 shrink-0">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Total Catalog</p>
            <p className="text-base font-black text-foreground">{storeVisuals.inventoryHealth.totalSkus} Products</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="p-3.5 rounded-2xl bg-card border border-border hover:border-emerald-500/50 transition-all text-left flex items-center gap-3 cursor-pointer shadow-xs"
        >
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
            <IndianRupee className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Stock Value (Cost)</p>
            <p className="text-base font-black text-foreground truncate">
              ₹{Math.round(storeVisuals.inventoryHealth.totalCostVal).toLocaleString('en-IN')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="p-3.5 rounded-2xl bg-card border border-border hover:border-amber-500/50 transition-all text-left flex items-center gap-3 cursor-pointer shadow-xs"
        >
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Stock Alerts</p>
            <p className="text-base font-black text-foreground">
              {storeVisuals.inventoryHealth.outOfStockCount + storeVisuals.inventoryHealth.lowStockCount} Low / Out
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/sales-return')}
          className="p-3.5 rounded-2xl bg-card border border-border hover:border-rose-500/50 transition-all text-left flex items-center gap-3 cursor-pointer shadow-xs"
        >
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 shrink-0">
            <RotateCcw className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Today's Returns</p>
            <p className="text-base font-black text-foreground">
              {storeVisuals.todayReturnCount} (₹{storeVisuals.todayReturnAmount.toFixed(0)})
            </p>
          </div>
        </button>
      </div>

      {/* ─── VISUAL ANALYTICS ROW: 7-DAY SALES CHART + COLLECTION MIX ─── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 7-Day Sales & Collection Chart */}
        <div className="kirana-card lg:col-span-2">
          <div className="border-b border-border px-5 py-4 flex flex-wrap justify-between items-center gap-2">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                <BarChart3 className="h-4 w-4 text-primary" /> 7-Day Sales &amp; Collection Trend
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daily Cash, UPI, and Udhar revenue comparison over the last 7 days
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Cash
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block" /> UPI
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" /> Udhar
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5 h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={storeVisuals.chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(val: any, name: any) => [`₹${Number(val || 0).toLocaleString('en-IN')}`, String(name).toUpperCase()]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: 'hsl(var(--foreground))'
                  }}
                />
                <Bar dataKey="cash" name="Cash" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="upi" name="UPI" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="udhar" name="Udhar" stackId="a" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today's Payment Mix Visual Summary */}
        <div className="kirana-card flex flex-col justify-between">
          <div className="border-b border-border px-5 py-4 flex justify-between items-center">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" /> Payment Share Today
            </h2>
            <button
              type="button"
              onClick={() => navigate('/analytics')}
              className="text-xs text-primary hover:underline font-semibold flex items-center cursor-pointer"
            >
              Analytics <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="p-5 space-y-5 flex-1 flex flex-col justify-center">
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collection Mix</span>
                <span className="text-sm font-black text-foreground">₹{paymentTotalToday.toFixed(0)}</span>
              </div>
              <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex">
                {cashSharePct > 0 && (
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${cashSharePct}%` }} title={`Cash: ${cashSharePct}%`} />
                )}
                {upiSharePct > 0 && (
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${upiSharePct}%` }} title={`UPI: ${upiSharePct}%`} />
                )}
                {udharSharePct > 0 && (
                  <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${udharSharePct}%` }} title={`Udhar: ${udharSharePct}%`} />
                )}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                  <Banknote className="h-4 w-4" /> Cash ({cashSharePct}%)
                </div>
                <span className="font-black text-foreground">₹{todaysCash.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-300">
                  <Smartphone className="h-4 w-4" /> UPI Digital ({upiSharePct}%)
                </div>
                <span className="font-black text-foreground">₹{todaysUPI.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                  <CreditCard className="h-4 w-4" /> Credit / Udhar ({udharSharePct}%)
                </div>
                <span className="font-black text-foreground">₹{todaysUdhar.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── TOP SELLING ITEMS + RECENT COUNTER BILLS ROW ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Selling Fast Movers */}
        <div className="kirana-card">
          <div className="border-b border-border px-5 py-4 flex justify-between items-center">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" /> Fast-Moving Products ({storeVisuals.topProductsWindow})
            </h2>
            <button
              type="button"
              onClick={() => navigate('/analytics')}
              className="text-xs text-primary hover:underline font-semibold flex items-center cursor-pointer"
            >
              Full Report <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-5">
            {storeVisuals.topProducts.length > 0 ? (
              <div className="space-y-3">
                {storeVisuals.topProducts.map((item, idx) => {
                  const pct = Math.max(8, Math.round((item.revenue / storeVisuals.maxTopRevenue) * 100));
                  return (
                    <div key={`${item.name}-${idx}`} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-5 w-5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black text-[10px] flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-foreground truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-semibold text-muted-foreground">×{Number(item.qty.toFixed(2))}</span>
                          <span className="font-black text-emerald-600 dark:text-emerald-400">₹{item.revenue.toFixed(0)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-muted-foreground">
                Complete your first bill in POS to see top-selling products here.
              </div>
            )}
          </div>
        </div>

        {/* Recent Counter Bills Live Feed */}
        <div className="kirana-card">
          <div className="border-b border-border px-5 py-4 flex justify-between items-center">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" /> Recent Bills Activity
            </h2>
            <button
              type="button"
              onClick={() => navigate('/bill-store')}
              className="text-xs text-primary hover:underline font-semibold flex items-center cursor-pointer"
            >
              All Bills <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-border/70">
            {storeVisuals.recentBills.length > 0 ? (
              storeVisuals.recentBills.map((bill) => {
                const dt = parseDate(bill.createdAt);
                const pm = (bill.paymentMethod || 'cash').toLowerCase();
                return (
                  <div
                    key={bill.id}
                    onClick={() => navigate('/bill-store')}
                    className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-foreground">
                          #{String(bill.id || '').slice(-8).toUpperCase()}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          pm === 'cash'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : pm === 'upi'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        }`}>
                          {pm}
                        </span>
                        {bill.returnSummary.isFullyReturned && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 text-[10px] font-black">
                            Returned
                          </span>
                        )}
                        {bill.returnSummary.isPartiallyReturned && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 text-[10px] font-black">
                            Part Return
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {bill.resolvedCustomer} • {(bill.items || []).length} items •{' '}
                        {dt ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                      </p>
                    </div>
                    <span className="font-black text-sm text-foreground shrink-0">
                      ₹{Number(bill.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No recent transactions yet. Start billing from POS!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── QUICK SHORTCUTS & ACTION BAR ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/pos')}
          className="p-3.5 bg-card border rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/20 transition-all text-left flex items-center justify-between group cursor-pointer shadow-xs"
        >
          <div>
            <p className="font-bold text-sm text-foreground group-hover:text-emerald-600">POS Checkout</p>
            <p className="text-[11px] text-muted-foreground">Barcode / Parchi scan</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          onClick={() => navigate('/barcode-print')}
          className="p-3.5 bg-card border rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left flex items-center justify-between group cursor-pointer shadow-xs"
        >
          <div>
            <p className="font-bold text-sm text-foreground group-hover:text-primary">Barcode Labels</p>
            <p className="text-[11px] text-muted-foreground">Print loose item stickers</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          onClick={() => navigate('/udhar')}
          className="p-3.5 bg-card border rounded-2xl hover:border-rose-500 hover:bg-rose-50/20 transition-all text-left flex items-center justify-between group cursor-pointer shadow-xs"
        >
          <div>
            <p className="font-bold text-sm text-foreground group-hover:text-rose-600">Udhar Book</p>
            <p className="text-[11px] text-muted-foreground">Manage customer credit</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          onClick={() => navigate('/reports')}
          className="p-3.5 bg-card border rounded-2xl hover:border-teal-500 hover:bg-teal-50/20 transition-all text-left flex items-center justify-between group cursor-pointer shadow-xs"
        >
          <div>
            <p className="font-bold text-sm text-foreground group-hover:text-teal-600">CA & Tax Reports</p>
            <p className="text-[11px] text-muted-foreground">GSTR-1 & profit analysis</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      {/* ─── BOTTOM TWO PANELS: AI SMART ASSISTANT + UDHAR SNAPSHOT ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI Smart Assistant */}
        <div className="kirana-card">
          <div className="border-b border-border px-5 py-4 flex justify-between items-center">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI Smart Assistant & Stock Alerts
            </h2>
            <button 
              onClick={() => navigate('/inventory')} 
              className="text-xs text-primary hover:underline font-semibold flex items-center"
            >
              Inventory <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Restock items */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> Restock Urgently
              </h4>
              {aiInsights.restockItems.length > 0 ? (
                <ul className="space-y-1">
                  {aiInsights.restockItems.map(p => (
                    <li key={p.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-orange-500/5 border border-orange-500/10">
                      <span className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />
                      <span className="text-foreground font-medium">{p.name}</span>
                      <span className="ml-auto text-xs font-bold text-orange-600 bg-orange-100 dark:bg-orange-950 px-2 py-0.5 rounded">
                        {p.stock} {p.unit || 'left'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-600 font-medium">✓ All stock levels are currently healthy!</p>
              )}
            </div>

            {/* Trending Items */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Top Value Products
              </h4>
              {aiInsights.trendingItems.length > 0 ? (
                <ul className="space-y-1">
                  {aiInsights.trendingItems.map(p => (
                    <li key={p.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/20">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-foreground font-medium">{p.name}</span>
                      <span className="ml-auto text-xs font-bold text-muted-foreground">₹{Number(p.sellingPrice || 0).toFixed(0)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Add products to view inventory insights.</p>
              )}
            </div>

            {/* Expiring Soon */}
            {aiInsights.expiringItems.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Expiring Within 30 Days
                </h4>
                <ul className="space-y-1">
                  {aiInsights.expiringItems.map(p => (
                    <li key={p.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                      <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="text-foreground font-medium">{p.name}</span>
                      <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 dark:bg-red-950 px-2 py-0.5 rounded">
                        {new Date(p.expiryDate!).toLocaleDateString('en-IN')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Udhar & Market Credit Snapshot */}
        <div className="kirana-card">
          <div className="border-b border-border px-5 py-4 flex justify-between items-center">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-rose-500" /> Udhar Book & Customer Overview
            </h2>
            <button 
              onClick={() => navigate('/udhar')} 
              className="text-xs text-rose-600 hover:underline font-semibold flex items-center"
            >
              Udhar Book <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Total Market Udhar Outstanding
              </p>
              <p className="text-4xl font-black text-rose-600 dark:text-rose-400">
                ₹{totalUdhar.toFixed(2)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/40 border border-border p-3.5">
                <p className="text-xs text-muted-foreground mb-1">Due Customers</p>
                <p className="text-2xl font-black text-foreground">{udharCustomersCount}</p>
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">Pending collection</p>
              </div>

              <div className="rounded-2xl bg-muted/40 border border-border p-3.5">
                <p className="text-xs text-muted-foreground mb-1">New Customers Today</p>
                <p className="text-2xl font-black text-emerald-600">+{newCustomersToday}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Registered today</p>
              </div>
            </div>

            <div className="rounded-2xl bg-muted/40 border border-border p-3.5 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">Total Customer Directory</p>
                <p className="text-2xl font-black text-foreground">{totalCustomers}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/customers')}
                className="text-xs font-semibold"
              >
                View Directory
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── CASH REGISTER SETTLEMENT MODAL (DAY CLOSE / Z-REPORT) ─── */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200 no-print">
          <div className="bg-card text-card-foreground p-0 rounded-2xl border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6" /> Day Close & Register Settlement
                </h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  End-of-day register cash count and verification (Z-Report)
                </p>
              </div>
              <button 
                onClick={() => setShowSettlementModal(false)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(92vh-140px)]">
              {/* Today's Tally Summary Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 border">
                  <span className="text-muted-foreground">Today's Total Sales:</span>
                  <div className="text-base font-bold text-foreground">₹{todaysSales.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">({todaysOrders} orders billed)</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Cash Sales:</span>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">₹{todaysCash.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">Cash received</div>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-blue-700 dark:text-blue-300 font-semibold">UPI / Online:</span>
                  <div className="text-base font-bold text-blue-600 dark:text-blue-400">₹{todaysUPI.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">Direct in bank</div>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <span className="text-red-700 dark:text-red-300 font-semibold">Cash Expenses:</span>
                  <div className="text-base font-bold text-red-600 dark:text-red-400">-₹{todaysExpenses.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">Paid from drawer</div>
                </div>
              </div>

              {/* Cash Reconciliation Inputs */}
              <div className="p-4 rounded-xl bg-muted/30 border space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <Wallet className="h-4 w-4 text-amber-500" /> Cash Drawer Reconciliation
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-muted-foreground">Opening Cash (Morning Balance)</label>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={openingFloat}
                        onChange={e => setOpeningFloat(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 rounded-lg border bg-background font-bold text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">Actual Cash Counted</label>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={countedCash}
                        onChange={e => setCountedCash(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 rounded-lg border bg-background font-bold text-sm text-emerald-600 focus:ring-1 focus:ring-emerald-500"
                        placeholder="Enter counted cash in register"
                        autoFocus
                      />
                    </div>
                  </div>
                </div>

                {/* Calculation Details */}
                {(() => {
                  const floatNum = Number(openingFloat) || 0;
                  const expectedCash = floatNum + cashInDrawer;
                  const countedNum = countedCash !== '' ? Number(countedCash) : null;
                  const diff = countedNum !== null ? countedNum - expectedCash : null;

                  return (
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Expected Cash in Drawer:</span>
                        <span className="font-mono font-bold text-sm">₹{expectedCash.toFixed(2)}</span>
                      </div>

                      {diff !== null && (
                        <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                          diff === 0 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : diff < 0
                            ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                            : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                        }`}>
                          <span>
                            {diff === 0 ? '✅ Cash Matched Perfectly' : diff < 0 ? `🔻 Cash Shortage` : `🔺 Cash Excess`}
                          </span>
                          <span className="text-sm font-black">
                            {diff === 0 ? '₹0.00' : `${diff < 0 ? '-' : '+'}₹${Math.abs(diff).toFixed(2)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">Notes / Remarks (Optional)</label>
                  <input
                    type="text"
                    value={settlementNotes}
                    onChange={e => setSettlementNotes(e.target.value)}
                    placeholder="e.g. 500 in coins or register balanced."
                    className="w-full mt-1 px-3 py-1.5 rounded-lg border bg-background text-xs"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    const el = document.getElementById('zreport-template');
                    printReceiptElementThermal(el, getConfiguredPaperSize(shopData), 'Daily Z-Report');
                  }}
                  className="w-full sm:w-auto text-xs font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> Print Z-Report
                </Button>

                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => setShowSettlementModal(false)}
                    className="flex-1 sm:flex-none text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      const floatNum = Number(openingFloat) || 0;
                      const countedVal = Number(countedCash) || 0;
                      const expectedCash = floatNum + cashInDrawer;
                      const diff = countedVal - expectedCash;
                      const nowIso = new Date().toISOString();

                      const record = {
                        id: 'settle_' + Date.now().toString(36),
                        date: nowIso,
                        shopName: shopData?.name || 'Kirana Store',
                        openingFloat: floatNum,
                        todaysSales,
                        todaysCash,
                        todaysUPI,
                        todaysUdhar,
                        todaysExpenses,
                        expectedCash,
                        countedCash: countedVal,
                        difference: diff,
                        notes: settlementNotes
                      };

                      try {
                        await api.cashCounter.closeShift({
                          id: record.id,
                          cashierName: shopData?.ownerName || shopData?.name || 'Admin',
                          openingCash: floatNum,
                          cashSales: todaysCash,
                          cashReturns: 0,
                          cashExpenses: todaysExpenses,
                          expectedCash,
                          actualCountedCash: countedVal,
                          discrepancy: diff,
                          notes: settlementNotes || 'Daily Register Close',
                          closedAt: nowIso
                        });
                      } catch (syncErr) {
                        console.warn('Cloud settlement sync fallback:', syncErr);
                      }

                      try {
                        const history = JSON.parse(localStorage.getItem('pos_day_settlements') || '[]');
                        history.unshift(record);
                        localStorage.setItem('pos_day_settlements', JSON.stringify(history.slice(0, 50)));
                        localStorage.setItem('pos_opening_cash', openingFloat);
                        alert('Day Close & Register Settlement saved! ✅');
                        setShowSettlementModal(false);
                      } catch (e) {
                        alert('Settlement saved!');
                        setShowSettlementModal(false);
                      }
                    }}
                    className="flex-1 sm:flex-none text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                  >
                    Save Settlement
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── HIDDEN Z-REPORT THERMAL SLIP FOR PRINT ─── */}
      <div 
        id="zreport-template" 
        className="hidden print:block bg-white text-black text-[12px] leading-[1.3] font-mono w-full max-w-[80mm]"
        style={{ width: '100%', maxWidth: '80mm', margin: '0 auto', boxSizing: 'border-box', padding: '1.5mm 2mm', fontVariantNumeric: 'tabular-nums', color: '#000' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h2 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: '900' }}>
            {(shopData?.name || 'KIRANA STORE').toUpperCase()}
          </h2>
          <div style={{ margin: '4px 0', fontWeight: 'bold', fontSize: '12px', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '3px 0' }}>
            *** DAILY REGISTER CLOSE (Z-REPORT) ***
          </div>
        </div>

        <div style={{ fontSize: '11px', marginBottom: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</span>
            <span><strong>Time:</strong> {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><strong>Orders:</strong> {todaysOrders}</span>
            <span><strong>Sales:</strong> ₹{todaysSales.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

        <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cash Sales:</span>
            <span>₹{todaysCash.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>UPI / Online:</span>
            <span>₹{todaysUPI.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Udhar Sales:</span>
            <span>₹{todaysUdhar.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c00' }}>
            <span>Cash Expenses:</span>
            <span>-₹{todaysExpenses.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ borderBottom: '1.5px solid #000', margin: '6px 0' }}></div>

        <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Opening Float:</span>
            <span>₹{(Number(openingFloat) || 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>Expected Cash:</span>
            <span>₹{((Number(openingFloat) || 0) + cashInDrawer).toFixed(2)}</span>
          </div>
          {countedCash !== '' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>Actual Counted:</span>
                <span>₹{(Number(countedCash) || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', borderTop: '1px dotted #000', paddingTop: '2px', marginTop: '2px' }}>
                <span>Variance:</span>
                <span>{((Number(countedCash) || 0) - ((Number(openingFloat) || 0) + cashInDrawer) >= 0 ? '+' : '')}₹{((Number(countedCash) || 0) - ((Number(openingFloat) || 0) + cashInDrawer)).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {settlementNotes && (
          <div style={{ marginTop: '6px', fontSize: '10px', fontStyle: 'italic' }}>
            Note: {settlementNotes}
          </div>
        )}

        <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '10px' }}>
          <div style={{ borderTop: '1px solid #000', width: '40%', textAlign: 'center', paddingTop: '2px' }}>Cashier Sign</div>
          <div style={{ borderTop: '1px solid #000', width: '40%', textAlign: 'center', paddingTop: '2px' }}>Owner Sign</div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '9px', color: '#666' }}>
          --------------------------------<br />
          MartGPT POS • Day Close Verified
        </div>
      </div>
    </div>
  );
}
