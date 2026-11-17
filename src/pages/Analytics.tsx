import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, AlertTriangle, ShoppingBag, 
  IndianRupee, CreditCard, Users, BarChart3, Sparkles,
  ArrowUpRight, ArrowDownRight, Flame, Calendar,
  Star, Gem, Share2, Check, MessageSquare, ShieldAlert, Zap,
  Layers, Award, Box, Crown, Handshake, Target, Clock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import type { Transaction, Product, Customer, Expense, UdharTransaction } from '../types';

type TimeRange = 'today' | '7days' | '30days' | 'customMonth' | 'all';
type AnalyticsTab = 'overview' | 'categories' | 'inventory' | 'timing' | 'customers' | 'udhar' | 'basket' | 'forecasting';

export default function Analytics() {
  const { shopData } = useAuth();
  const [sales, setSales] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [udharRecords, setUdharRecords] = useState<UdharTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('30days');
  const [customMonth, setCustomMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [festivalMultiplier, setFestivalMultiplier] = useState<number>(1.0);
  const [forecastHorizonDays, setForecastHorizonDays] = useState<number>(14);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txList, prodList, custList, expList, udharList] = await Promise.all([
        api.transactions.list().catch(() => []),
        api.products.list().catch(() => []),
        api.customers.list().catch(() => []),
        api.expenses.list().catch(() => []),
        api.udhar.list().catch(() => [])
      ]);
      setSales(Array.isArray(txList) ? txList : []);
      setProducts(Array.isArray(prodList) ? prodList : []);
      setCustomers(Array.isArray(custList) ? custList : []);
      setExpenses(Array.isArray(expList) ? expList : []);
      setUdharRecords(Array.isArray(udharList) ? udharList : []);
    } catch (err: any) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [shopData?.shopId]);

  // Robust Date Parser
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

  // 1. Time-filtered Sales
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

  // 1b. Previous Period Sales for Growth Comparison
  const prevPeriodSales = useMemo(() => {
    const now = new Date();
    if (timeRange === 'today') {
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return sales.filter(s => {
        const d = parseDate(s.createdAt);
        return d && d >= yesterdayStart && d < yesterdayEnd;
      });
    }
    if (timeRange === '7days') {
      const end = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      return sales.filter(s => {
        const d = parseDate(s.createdAt);
        return d && d >= start && d < end;
      });
    }
    if (timeRange === '30days') {
      const end = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      return sales.filter(s => {
        const d = parseDate(s.createdAt);
        return d && d >= start && d < end;
      });
    }
    return [];
  }, [sales, timeRange]);

  // 2. Filtered Expenses
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return expenses.filter(e => {
      const d = parseDate(e.date || e.createdAt);
      if (!d) return true;
      if (timeRange === 'today') return d >= todayStart;
      if (timeRange === '7days') return d >= sevenDaysAgo;
      if (timeRange === '30days') return d >= thirtyDaysAgo;
      if (timeRange === 'customMonth' && customMonth) {
        const [y, m] = customMonth.split('-').map(Number);
        return d.getFullYear() === y && d.getMonth() === (m - 1);
      }
      return true;
    });
  }, [expenses, timeRange, customMonth]);

  // 3. Financial Overview (Revenue, COGS, Gross Profit, Expenses, Net Profit)
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

    const grossProfit = Math.max(0, totalRevenue - totalCost);
    const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const avgTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = grossProfit - totalExpenses;

    // Previous period revenue
    const prevRevenue = prevPeriodSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null;

    return {
      revenue: totalRevenue,
      cost: totalCost,
      tax: totalTax,
      discount: totalDiscount,
      grossProfit,
      marginPercent,
      avgTicket,
      totalBills: filteredSales.length,
      totalExpenses,
      netProfit,
      revenueGrowth
    };
  }, [filteredSales, prevPeriodSales, products, filteredExpenses]);

  // 4. Daily Sales Trend Area Chart
  const dailyTrendData = useMemo(() => {
    const map = new Map<string, { date: string; displayDate: string; revenue: number; profit: number; bills: number }>();

    const prodMap = new Map<string, Product>();
    products.forEach(p => prodMap.set(p.id, p));

    filteredSales.forEach(s => {
      const d = parseDate(s.createdAt);
      if (!d) return;
      const key = d.toISOString().slice(0, 10);
      const displayDate = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;

      let cost = 0;
      (s.items || []).forEach(it => {
        const prod = prodMap.get(it.id);
        const pp = it.purchasePrice || prod?.purchasePrice || 0;
        cost += (Number(pp) || 0) * (Number(it.qty) || 1);
      });

      const rev = Number(s.totalAmount) || 0;
      const profit = Math.max(0, rev - cost);

      const existing = map.get(key) || { date: key, displayDate, revenue: 0, profit: 0, bills: 0 };
      existing.revenue += rev;
      existing.profit += profit;
      existing.bills += 1;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales, products]);

  // 5. Payment Methods Distribution
  const paymentData = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let udhar = 0;
    let card = 0;

    filteredSales.forEach(b => {
      const amt = Number(b.totalAmount) || 0;
      if (b.paymentMethod === 'cash') cash += amt;
      else if (b.paymentMethod === 'upi') upi += amt;
      else if (b.paymentMethod === 'udhar') udhar += amt;
      else if (b.paymentMethod === 'card') card += amt;
    });

    return [
      { name: '💵 Cash', value: cash, color: '#10b981', label: 'Cash' },
      { name: '📱 UPI / QR', value: upi, color: '#6366f1', label: 'UPI / QR' },
      { name: '📕 Credit (Udhar)', value: udhar, color: '#f43f5e', label: 'Udhar' },
      { name: '💳 Card', value: card, color: '#0ea5e9', label: 'Card' }
    ].filter(p => p.value > 0);
  }, [filteredSales]);

  // 6. Category Intelligence
  const categoryData = useMemo(() => {
    const prodMap = new Map<string, Product>();
    products.forEach(p => prodMap.set(p.id, p));

    const map = new Map<string, { category: string; qty: number; revenue: number; profit: number }>();

    filteredSales.forEach(s => {
      (s.items || []).forEach(it => {
        const prod = prodMap.get(it.id);
        const cat = (it.category || prod?.category || 'General').trim() || 'General';
        const qty = Number(it.qty) || 1;
        const rev = (Number(it.sellingPrice) || 0) * qty;
        const pp = it.purchasePrice || prod?.purchasePrice || 0;
        const profit = Math.max(0, rev - (Number(pp) || 0) * qty);

        const existing = map.get(cat) || { category: cat, qty: 0, revenue: 0, profit: 0 };
        existing.qty += qty;
        existing.revenue += rev;
        existing.profit += profit;
        map.set(cat, existing);
      });
    });

    const list = Array.from(map.values()).map(c => ({
      ...c,
      marginPercent: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
      sharePercent: financials.revenue > 0 ? (c.revenue / financials.revenue) * 100 : 0
    }));

    return list.sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, products, financials.revenue]);

  // 7. Day-of-Week Trends (Sunday to Saturday)
  const dayOfWeekData = useMemo(() => {
    const days = [
      { dayIndex: 0, name: 'Sunday', short: 'Sun', marathi: 'Sunday', revenue: 0, orders: 0 },
      { dayIndex: 1, name: 'Monday', short: 'Mon', marathi: 'Monday', revenue: 0, orders: 0 },
      { dayIndex: 2, name: 'Tuesday', short: 'Tue', marathi: 'Tuesday', revenue: 0, orders: 0 },
      { dayIndex: 3, name: 'Wednesday', short: 'Wed', marathi: 'Wednesday', revenue: 0, orders: 0 },
      { dayIndex: 4, name: 'Thursday', short: 'Thu', marathi: 'Thursday', revenue: 0, orders: 0 },
      { dayIndex: 5, name: 'Friday', short: 'Fri', marathi: 'Friday', revenue: 0, orders: 0 },
      { dayIndex: 6, name: 'Saturday', short: 'Sat', marathi: 'Saturday', revenue: 0, orders: 0 },
    ];

    filteredSales.forEach(s => {
      const d = parseDate(s.createdAt);
      if (!d) return;
      const idx = d.getDay();
      days[idx].orders += 1;
      days[idx].revenue += Number(s.totalAmount) || 0;
    });

    let peakDay = days[0];
    days.forEach(d => {
      if (d.revenue > peakDay.revenue) peakDay = d;
    });

    return { days, peakDay };
  }, [filteredSales]);

  // 8. Hourly Velocity (7 AM to 10 PM)
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

    const hours = Array.from({ length: 16 }, (_, i) => {
      const hr = i + 7; // 7 AM to 10 PM
      const label = hr < 12 ? `${hr} AM` : hr === 12 ? '12 PM' : `${hr - 12} PM`;
      return {
        hour: hr,
        label,
        orders: counts[hr] || 0,
        revenue: revenues[hr] || 0
      };
    });

    let peakHour = { hour: 0, label: '—', orders: 0, revenue: 0 };
    hours.forEach(h => {
      if (h.orders > peakHour.orders) peakHour = h;
    });

    return { hours, peakHour };
  }, [filteredSales]);

  // 9. Smart Inventory: ABC Matrix & Velocity
  const inventoryAnalytics = useMemo(() => {
    const soldMap = new Map<string, { qty: number; revenue: number; profit: number }>();
    const prodMap = new Map<string, Product>();
    products.forEach(p => prodMap.set(p.id, p));

    filteredSales.forEach(s => {
      (s.items || []).forEach(it => {
        const prod = prodMap.get(it.id);
        const qty = Number(it.qty) || 1;
        const rev = (Number(it.sellingPrice) || 0) * qty;
        const pp = it.purchasePrice || prod?.purchasePrice || 0;
        const profit = Math.max(0, rev - (Number(pp) || 0) * qty);

        const existing = soldMap.get(it.id) || { qty: 0, revenue: 0, profit: 0 };
        existing.qty += qty;
        existing.revenue += rev;
        existing.profit += profit;
        soldMap.set(it.id, existing);
      });
    });

    const totalSoldUnits = Array.from(soldMap.values()).reduce((sum, v) => sum + v.qty, 0);
    const avgUnitsSold = soldMap.size > 0 ? totalSoldUnits / soldMap.size : 1;

    // Stars, Cash Cows, Gems, Dead Stock
    const stars: any[] = [];
    const cashCows: any[] = [];
    const highMarginGems: any[] = [];
    const deadStockList: any[] = [];
    const fastDepleting: any[] = [];

    products.forEach(p => {
      const sold = soldMap.get(p.id);
      const stock = Number(p.stock) || 0;
      const sp = Number(p.sellingPrice) || 0;
      const pp = Number(p.purchasePrice) || 0;
      const margin = sp > 0 ? ((sp - pp) / sp) * 100 : 0;

      if (!sold || sold.qty === 0) {
        if (stock > 0) {
          deadStockList.push({
            ...p,
            lockedCapital: (pp || sp) * stock
          });
        }
      } else {
        const isHighVolume = sold.qty >= avgUnitsSold;
        const isHighMargin = margin >= 18; // 18%+ gross margin

        if (isHighVolume && isHighMargin) {
          stars.push({ ...p, soldQty: sold.qty, revenue: sold.revenue, profit: sold.profit, margin });
        } else if (isHighVolume && !isHighMargin) {
          cashCows.push({ ...p, soldQty: sold.qty, revenue: sold.revenue, profit: sold.profit, margin });
        } else if (!isHighVolume && isHighMargin) {
          highMarginGems.push({ ...p, soldQty: sold.qty, revenue: sold.revenue, profit: sold.profit, margin });
        }

        // Fast Depleting check: if current days of stock < 3 days
        const daysInRange = timeRange === 'today' ? 1 : timeRange === '7days' ? 7 : 30;
        const dailyBurnRate = sold.qty / daysInRange;
        if (dailyBurnRate > 0 && stock > 0 && (stock / dailyBurnRate) <= 3) {
          fastDepleting.push({
            ...p,
            stock,
            dailyBurnRate: dailyBurnRate.toFixed(1),
            daysLeft: Math.max(1, Math.round(stock / dailyBurnRate))
          });
        }
      }
    });

    deadStockList.sort((a, b) => b.lockedCapital - a.lockedCapital);
    const totalDeadCapital = deadStockList.reduce((sum, d) => sum + d.lockedCapital, 0);

    return {
      stars: stars.sort((a, b) => b.profit - a.profit).slice(0, 10),
      cashCows: cashCows.sort((a, b) => b.soldQty - a.soldQty).slice(0, 10),
      highMarginGems: highMarginGems.sort((a, b) => b.margin - a.margin).slice(0, 10),
      deadStock: deadStockList.slice(0, 15),
      totalDeadCount: deadStockList.length,
      totalDeadCapital,
      fastDepleting: fastDepleting.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 8)
    };
  }, [filteredSales, products, timeRange]);

  // 10. Customer Insights & Top VIPs
  const customerAnalytics = useMemo(() => {
    const custSpendMap = new Map<string, { customerId: string; name: string; phone: string; bills: number; totalSpent: number; lastDate: Date | null }>();

    const registeredMap = new Map<string, Customer>();
    customers.forEach(c => registeredMap.set(c.id, c));

    let uniqueCustomerIds = new Set<string>();

    filteredSales.forEach(s => {
      const cid = s.customerId;
      if (!cid) return;
      uniqueCustomerIds.add(cid);

      const custObj = registeredMap.get(cid);
      const name = custObj?.name || 'Walk-in Customer';
      const phone = custObj?.phone || '';
      const d = parseDate(s.createdAt);

      const existing = custSpendMap.get(cid) || { customerId: cid, name, phone, bills: 0, totalSpent: 0, lastDate: null };
      existing.bills += 1;
      existing.totalSpent += Number(s.totalAmount) || 0;
      if (d && (!existing.lastDate || d > existing.lastDate)) {
        existing.lastDate = d;
      }
      custSpendMap.set(cid, existing);
    });

    const vipList = Array.from(custSpendMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Repeat customers (visited > 1 time)
    const repeatCount = Array.from(custSpendMap.values()).filter(c => c.bills > 1).length;
    const repeatRate = custSpendMap.size > 0 ? (repeatCount / custSpendMap.size) * 100 : 0;

    // Churn Alert: registered customers who visited in the past but haven't visited in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const inactiveCustomers = customers
      .filter(c => {
        const lastVisit = c.createdAt ? parseDate(c.createdAt) : null;
        const hasSpend = (Number(c.totalSpent) || 0) > 0 || (Number(c.visits) || 0) > 0;
        return hasSpend && lastVisit && lastVisit < thirtyDaysAgo;
      })
      .slice(0, 6);

    return {
      vipList,
      totalActiveCustomers: custSpendMap.size,
      repeatRate,
      inactiveCustomers
    };
  }, [filteredSales, customers]);

  // 11. Khata & Udhar Risk Analytics
  const udharAnalytics = useMemo(() => {
    let udharGiven = 0;
    let udharRecovered = 0;

    filteredSales.forEach(s => {
      if (s.paymentMethod === 'udhar') {
        udharGiven += Number(s.totalAmount) || 0;
      }
    });

    filteredExpenses.forEach(e => {
      // ignore
    });

    udharRecords.forEach(u => {
      const d = parseDate(u.createdAt);
      if (u.type === 'payment' || (u.amount && u.amount < 0)) {
        udharRecovered += Math.abs(Number(u.amount) || 0);
      }
    });

    // Total outstanding balance across all customers
    const totalOutstanding = customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance) || 0), 0);
    const highestDefaulters = customers
      .filter(c => (Number(c.balance) || 0) > 0)
      .sort((a, b) => Number(b.balance) - Number(a.balance))
      .slice(0, 6);

    const recoveryRate = udharGiven > 0 ? Math.min(100, (udharRecovered / udharGiven) * 100) : 100;

    return {
      udharGiven,
      udharRecovered,
      totalOutstanding,
      recoveryRate,
      highestDefaulters
    };
  }, [filteredSales, filteredExpenses, udharRecords, customers]);

  // 12. Basket AI & Cross-Selling Combos (Frequently Bought Together)
  const basketCombos = useMemo(() => {
    const pairMap = new Map<string, { itemA: string; itemB: string; count: number }>();

    filteredSales.forEach(s => {
      const items = (s.items || []).filter(it => it && it.name);
      if (items.length < 2) return;

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const nameA = items[i].name.trim();
          const nameB = items[j].name.trim();
          if (nameA === nameB) continue;

          const sorted = [nameA, nameB].sort();
          const key = sorted.join(' + ');

          const existing = pairMap.get(key) || { itemA: sorted[0], itemB: sorted[1], count: 0 };
          existing.count += 1;
          pairMap.set(key, existing);
        }
      }
    });

    return Array.from(pairMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredSales]);

  // 11. D-Mart Demand Forecasting & Festival Stock Planner
  const demandForecasting = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const recentSales = sales.filter(s => {
      const d = new Date(s.createdAt || s.date);
      return !isNaN(d.getTime()) && d >= thirtyDaysAgo;
    });

    const itemSalesCount: Record<string, number> = {};
    recentSales.forEach(s => {
      (s.items || []).forEach(it => {
        const pid = it.productId || it.id;
        itemSalesCount[pid] = (itemSalesCount[pid] || 0) + (Number(it.qty) || 1);
      });
    });

    const forecasts = products.map(p => {
      const soldUnits = itemSalesCount[p.id] || 0;
      const velocityPerDay = soldUnits / 30;
      const currentStock = Number(p.stock) || 0;
      const runwayDays = velocityPerDay > 0 ? (currentStock / velocityPerDay) : 999;
      
      const projectedDemand = Math.round(velocityPerDay * forecastHorizonDays * festivalMultiplier);
      const suggestedPOQty = Math.max(0, projectedDemand - currentStock);
      const estPOCost = suggestedPOQty * (Number(p.purchasePrice) || 0);

      let urgency: 'critical' | 'warning' | 'healthy' | 'excess' = 'healthy';
      if (runwayDays <= 3) urgency = 'critical';
      else if (runwayDays <= 7) urgency = 'warning';
      else if (runwayDays > 45 && currentStock > 20) urgency = 'excess';

      return {
        product: p,
        soldUnits,
        velocityPerDay,
        currentStock,
        runwayDays,
        projectedDemand,
        suggestedPOQty,
        estPOCost,
        urgency
      };
    });

    forecasts.sort((a, b) => {
      if (a.urgency === 'critical' && b.urgency !== 'critical') return -1;
      if (b.urgency === 'critical' && a.urgency !== 'critical') return 1;
      if (a.urgency === 'warning' && b.urgency !== 'warning') return -1;
      if (b.urgency === 'warning' && a.urgency !== 'warning') return 1;
      return a.runwayDays - b.runwayDays;
    });

    const criticalCount = forecasts.filter(f => f.urgency === 'critical').length;
    const warningCount = forecasts.filter(f => f.urgency === 'warning').length;
    const totalPOCost = forecasts.reduce((sum, f) => sum + f.estPOCost, 0);

    return {
      forecasts,
      criticalCount,
      warningCount,
      totalPOCost
    };
  }, [sales, products, festivalMultiplier, forecastHorizonDays]);

  // 13. Generate WhatsApp Executive Summary Text
  const generateWhatsAppSummary = () => {
    const shopName = shopData?.name || 'Nayash Kirana';
    const rangeLabel = 
      timeRange === 'today' ? 'Today' : 
      timeRange === '7days' ? 'Last 7 Days' : 
      timeRange === '30days' ? 'Last 30 Days' : 
      timeRange === 'customMonth' ? `Month (${customMonth})` : 'All Time';

    const topItem = inventoryAnalytics.stars[0]?.name || inventoryAnalytics.cashCows[0]?.name || 'N/A';
    const topCat = categoryData[0]?.category || 'General';

    return `📊 *${shopName.toUpperCase()} - BUSINESS ANALYTICS REPORT*
📅 *Period:* ${rangeLabel}
━━━━━━━━━━━━━━━━━━━━
💰 *Total Revenue:* ₹${financials.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
📈 *Gross Profit:* ₹${financials.grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${financials.marginPercent.toFixed(1)}% margin)
💸 *Shop Expenses:* ₹${financials.totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
💵 *Net Net Profit:* ₹${financials.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
━━━━━━━━━━━━━━━━━━━━
🧾 *Total Invoices:* ${financials.totalBills} bills
🛍️ *Average Bill Value:* ₹${financials.avgTicket.toFixed(0)}
👑 *Top Category:* ${topCat} (₹${(categoryData[0]?.revenue || 0).toLocaleString('en-IN')} revenue)
🔥 *Top Product:* ${topItem}
⏰ *Peak Shopping Hour:* ${hourlyData.peakHour.label} (${hourlyData.peakHour.orders} bills)
📅 *Best Day:* ${dayOfWeekData.peakDay.name} (${dayOfWeekData.peakDay.marathi})
━━━━━━━━━━━━━━━━━━━━
💳 *Payment Split:*
• 💵 Cash: ₹${(paymentData.find(p => p.label === 'Cash')?.value || 0).toLocaleString('en-IN')}
• 📱 UPI: ₹${(paymentData.find(p => p.label === 'UPI / QR')?.value || 0).toLocaleString('en-IN')}
• 📕 Udhar: ₹${(paymentData.find(p => p.label === 'Udhar')?.value || 0).toLocaleString('en-IN')}
━━━━━━━━━━━━━━━━━━━━
✨ *Generated instantly by MartGPT Digital AI*`;
  };

  const handleCopySummary = () => {
    const text = generateWhatsAppSummary();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  const handleSendWhatsAppSummary = () => {
    const text = encodeURIComponent(generateWhatsAppSummary());
    const phone = shopData?.phone ? shopData.phone.replace(/[^0-9]/g, '') : '';
    const url = phone ? `https://wa.me/91${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <TrendingUp className="h-7 w-7 text-emerald-500 shrink-0" /> 
            Digital Store Analytics & Intelligence
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Real-time Kirana metrics: Profit margins, peak footfall hours, ABC stock velocity, category share and Udhar risk.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-between lg:justify-end">
          {/* Time Range Pills */}
          <div className="flex items-center gap-1 bg-muted/60 p-1.5 rounded-2xl border border-border flex-wrap">
            {[
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
              { id: 'all', label: 'All' }
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
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all ${
              timeRange === 'customMonth'
                ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                : 'bg-card text-muted-foreground hover:text-foreground border-border'
            }`}>
              <Calendar className="h-3.5 w-3.5 shrink-0" />
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

          {/* WhatsApp Summary Button */}
          <Button
            onClick={() => setShowSummaryModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 rounded-xl shadow-xs"
          >
            <Share2 className="h-4 w-4" /> 
            <span>WhatsApp Summary 📱</span>
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'overview', label: '📊 Financial Overview', marathi: 'Cash & Profit' },
          { id: 'categories', label: '📦 Category Intelligence', marathi: 'Category Margin' },
          { id: 'inventory', label: '⭐ ABC Stock & Stars', marathi: 'ABC Classification' },
          { id: 'forecasting', label: '🔮 Demand Forecasting (D-Mart AI)', marathi: 'Demand Prediction' },
          { id: 'timing', label: '📅 Peak Hours & Days', marathi: 'Peak Hours' },
          { id: 'customers', label: '👥 VIP Customers & Retention', marathi: 'Customer Loyalty' },
          { id: 'udhar', label: '💳 Khata & Recovery', marathi: 'Udhar Recovery' },
          { id: 'basket', label: '🛒 Basket AI Combos', marathi: 'Cross-Sell Combos' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FINANCIAL OVERVIEW                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Revenue */}
            <div className="rounded-2xl border bg-card p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <IndianRupee className="h-4 w-4 text-emerald-500" /> Total Revenue
                </span>
                {financials.revenueGrowth !== null && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                    financials.revenueGrowth >= 0 
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  }`}>
                    {financials.revenueGrowth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(financials.revenueGrowth).toFixed(0)}% vs prev
                  </span>
                )}
              </div>
              <p className="text-2xl font-black text-foreground mt-1.5">
                ₹{financials.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Total {financials.totalBills} customer transactions
              </p>
            </div>

            {/* Gross Profit */}
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-500" /> Gross Profit
              </span>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1.5">
                ₹{financials.grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> {financials.marginPercent.toFixed(1)}% Gross Margin
              </p>
            </div>

            {/* Net Profit (After Expenses) */}
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-indigo-500" /> Net Profit (In Hand)
              </span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1.5">
                ₹{financials.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                After ₹{financials.totalExpenses.toLocaleString('en-IN')} shop expenses
              </p>
            </div>

            {/* Average Basket Size */}
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-blue-500" /> Average Ticket Size
              </span>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1.5">
                ₹{financials.avgTicket.toFixed(0)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Avg spend per customer visit
              </p>
            </div>
          </div>

          {/* Daily Sales & Profit Area Chart */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" /> Daily Sales & Profit Trajectory
                </h3>
                <p className="text-xs text-muted-foreground">
                  Day-by-day revenue velocity compared with daily gross profit.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Sales Revenue
                </span>
                <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Gross Profit
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              {dailyTrendData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  No sales data recorded in this timeframe.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="displayDate" fontSize={11} stroke="#888" />
                    <YAxis fontSize={11} stroke="#888" tickFormatter={(v) => `₹${v}`} />
                    <Tooltip 
                      formatter={(val: any, name: string) => [
                        `₹${Number(val).toLocaleString('en-IN')}`,
                        name === 'revenue' ? 'Revenue' : 'Gross Profit'
                      ]}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" name="revenue" />
                    <Area type="monotone" dataKey="profit" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" name="profit" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Payment Modes Breakdown */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-500" /> Payment Methods Split
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CATEGORY INTELLIGENCE                                              */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          {/* Category Performance Summary Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-amber-500" /> Highest Revenue Category
              </span>
              <p className="text-xl font-black text-foreground mt-1 truncate">
                {categoryData[0]?.category || '—'}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                ₹{(categoryData[0]?.revenue || 0).toLocaleString('en-IN')} ({(categoryData[0]?.sharePercent || 0).toFixed(1)}% share)
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Gem className="h-4 w-4 text-purple-500" /> Highest Margin Category
              </span>
              {(() => {
                const highestMarginCat = [...categoryData].sort((a, b) => b.marginPercent - a.marginPercent)[0];
                return (
                  <>
                    <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1 truncate">
                      {highestMarginCat?.category || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {highestMarginCat ? `${highestMarginCat.marginPercent.toFixed(1)}% Profit Margin` : '—'}
                    </p>
                  </>
                );
              })()}
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Box className="h-4 w-4 text-blue-500" /> Total Active Categories
              </span>
              <p className="text-xl font-black text-foreground mt-1">
                {categoryData.length} Categories
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Contributing to current billing volume
              </p>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" /> Category-wise Sales & Profit Contribution
                </h3>
                <p className="text-xs text-muted-foreground">
                  Complete margin and volume distribution across product departments.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="pb-3 font-bold">Category</th>
                    <th className="pb-3 font-bold text-center">Units Sold</th>
                    <th className="pb-3 font-bold text-right">Revenue (₹)</th>
                    <th className="pb-3 font-bold text-right">Gross Profit (₹)</th>
                    <th className="pb-3 font-bold text-right">Margin %</th>
                    <th className="pb-3 font-bold text-right">Sales Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoryData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        No sales recorded for any category yet.
                      </td>
                    </tr>
                  ) : (
                    categoryData.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 font-bold text-foreground flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          {cat.category}
                        </td>
                        <td className="py-3 text-center text-muted-foreground font-semibold">
                          {cat.qty.toLocaleString('en-IN')} units
                        </td>
                        <td className="py-3 text-right font-black text-foreground">
                          ₹{cat.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 text-right font-black text-purple-600 dark:text-purple-400">
                          ₹{cat.profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {cat.marginPercent.toFixed(1)}%
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-bold text-muted-foreground text-[11px]">{cat.sharePercent.toFixed(1)}%</span>
                            <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${cat.sharePercent}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SMART INVENTORY & ABC PRODUCT MATRIX                               */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* ABC Strategic Product Matrix Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stars */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-500" /> Star Products (🌟)
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white">
                  High Volume + High Margin
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your highest profit generators. Keep stock always available!
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {inventoryAnalytics.stars.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No star items identified.</p>
                ) : (
                  inventoryAnalytics.stars.map((p, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-card border text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-foreground truncate max-w-[150px]">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.soldQty} sold • {p.margin.toFixed(0)}% margin</p>
                      </div>
                      <span className="font-black text-amber-600 dark:text-amber-400">₹{p.profit.toFixed(0)} profit</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cash Cows */}
            <div className="rounded-2xl border border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/10 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                <span className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  <Box className="h-4 w-4 text-blue-500" /> Cash Cows (🐄)
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500 text-white">
                  High Volume + Low Margin
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Daily grocery staples (Sugar, Oil, Atta). Essential for customer footfall.
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {inventoryAnalytics.cashCows.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No cash cows identified.</p>
                ) : (
                  inventoryAnalytics.cashCows.map((p, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-card border text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-foreground truncate max-w-[150px]">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.soldQty} sold • ₹{p.sellingPrice}</p>
                      </div>
                      <span className="font-black text-blue-600 dark:text-blue-400">₹{p.revenue.toFixed(0)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* High-Margin Gems */}
            <div className="rounded-2xl border border-purple-500/30 bg-purple-50/20 dark:bg-purple-950/10 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                <span className="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                  <Gem className="h-4 w-4 text-purple-500" /> High-Margin Gems (💎)
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500 text-white">
                  Low Volume + High Margin
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                High profit per unit. Promote near billing counter to increase sales!
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {inventoryAnalytics.highMarginGems.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No gem items identified.</p>
                ) : (
                  inventoryAnalytics.highMarginGems.map((p, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-card border text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-foreground truncate max-w-[150px]">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.soldQty} sold • {p.margin.toFixed(0)}% margin</p>
                      </div>
                      <span className="font-black text-purple-600 dark:text-purple-400">₹{p.profit.toFixed(0)} profit</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Fast-Depleting Restock Soon Alert */}
          {inventoryAnalytics.fastDepleting.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" /> Fast Velocity: Running Out of Stock in &lt; 3 Days!
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Based on current daily sales velocity, order these items from wholesale distributors immediately.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {inventoryAnalytics.fastDepleting.map((p, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-card border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                    <p className="font-bold text-foreground truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">Current Stock: <strong className="text-foreground">{p.stock} {p.unit}</strong></p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">{p.dailyBurnRate} {p.unit}/day burn</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">
                        ~{p.daysLeft} day(s) left
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dead Stock / Slow Moving Inventory Alert */}
          <div className="rounded-2xl border border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/10 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
              <div>
                <h3 className="text-base font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-500" /> Slow Moving &amp; Dead Stock Alert
                </h3>
                <p className="text-xs text-muted-foreground">
                  Products with zero sales during the selected period.
                </p>
              </div>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-500 text-white">
                {inventoryAnalytics.totalDeadCount} items
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-rose-200 dark:border-rose-800 text-xs flex items-center justify-between">
              <div>
                <span className="text-muted-foreground font-semibold">Total Capital Locked in Idle Stock:</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Money stuck on shelves without earning profit</p>
              </div>
              <span className="font-black text-rose-600 dark:text-rose-400 text-lg">
                ₹{inventoryAnalytics.totalDeadCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {inventoryAnalytics.deadStock.length === 0 ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center py-4 font-semibold col-span-3">
                  All inventory is moving actively! Zero dead stock detected. 🎉
                </p>
              ) : (
                inventoryAnalytics.deadStock.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border bg-card text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.category || 'General'} • {p.stock} {p.unit}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-rose-600 dark:text-rose-400">₹{p.lockedCapital.toFixed(0)}</span>
                      <span className="block text-[9px] text-muted-foreground">locked</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="text-[11px] text-rose-700 dark:text-rose-300">
              💡 <strong>Action Tip:</strong> Put a 5% to 10% clearance sticker or bundle these items with top sellers to release trapped cash!
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PEAK HOURS & DAY-OF-WEEK TRENDS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'timing' && (
        <div className="space-y-6">
          {/* Day of the Week Sales Heatmap */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-500" /> Day-of-Week Sales Trends
                </h3>
                <p className="text-xs text-muted-foreground">
                  Which days bring maximum customer rush and turnover.
                </p>
              </div>
              {dayOfWeekData.peakDay.orders > 0 && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-300">
                  👑 Busiest Day: {dayOfWeekData.peakDay.name} – ₹{dayOfWeekData.peakDay.revenue.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
              {dayOfWeekData.days.map((d, idx) => {
                const isPeak = d.dayIndex === dayOfWeekData.peakDay.dayIndex && d.orders > 0;
                return (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      isPeak 
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20' 
                        : 'border-border bg-card'
                    }`}
                  >
                    <p className={`text-xs font-black ${isPeak ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`}>
                      {d.short}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{d.marathi}</p>
                    <p className="text-sm font-black text-foreground mt-2">
                      ₹{d.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {d.orders} bills
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hourly Store Velocity (7 AM - 10 PM) */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Flame className="h-5 w-5 text-amber-500" /> Hourly Store Velocity (Peak Hours)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Customer volume breakdown between 7:00 AM and 10:00 PM to help plan staff shifts.
                </p>
              </div>
              {hourlyData.peakHour.orders > 0 && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300">
                  ⚡ Peak Traffic: {hourlyData.peakHour.label} ({hourlyData.peakHour.orders} bills)
                </span>
              )}
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData.hours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            <p className="text-[11px] text-muted-foreground">
              💡 <strong>Staffing Tip:</strong> Peak hours typically occur in the morning (8–10 AM for milk &amp; breakfast) and evening (6–9 PM for groceries). Keep extra hands at the billing counter during these windows!
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: VIP CUSTOMERS & RETENTION                                          */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          {/* Customer Retention Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" /> Active Shopping Customers
              </span>
              <p className="text-2xl font-black text-foreground mt-1">
                {customerAnalytics.totalActiveCustomers}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Purchased during this timeframe</p>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Handshake className="h-4 w-4 text-emerald-500" /> Repeat Customer Rate
              </span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {customerAnalytics.repeatRate.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Customers who visited more than once</p>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> At-Risk Customers
              </span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {customerAnalytics.inactiveCustomers.length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Haven't visited in 30+ days</p>
            </div>
          </div>

          {/* Top 10 VIP Customers Leaderboard */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" /> Top 10 VIP Customers Leaderboard
                </h3>
                <p className="text-xs text-muted-foreground">
                  Your store's highest spending customers. Offer loyalty rewards to keep them happy!
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="pb-3 font-bold">Rank</th>
                    <th className="pb-3 font-bold">Customer Name</th>
                    <th className="pb-3 font-bold text-center">Visits</th>
                    <th className="pb-3 font-bold text-right">Total Spent</th>
                    <th className="pb-3 font-bold text-right">Avg Basket</th>
                    <th className="pb-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customerAnalytics.vipList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        No customer transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    customerAnalytics.vipList.map((cust, idx) => (
                      <tr key={idx} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 font-black">
                          {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                        </td>
                        <td className="py-3">
                          <p className="font-bold text-foreground">{cust.name}</p>
                          {cust.phone && <p className="text-[10px] text-muted-foreground font-mono">{cust.phone}</p>}
                        </td>
                        <td className="py-3 text-center font-semibold text-muted-foreground">
                          {cust.bills} visits
                        </td>
                        <td className="py-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{cust.totalSpent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 text-right font-bold text-foreground">
                          ₹{(cust.totalSpent / cust.bills).toFixed(0)}
                        </td>
                        <td className="py-3 text-right">
                          {cust.phone ? (
                            <a
                              href={`https://wa.me/91${cust.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                `Dear ${cust.name}! 🙏\nThank you for being our valued customer at ${shopData?.name || 'our store'}. We look forward to serving you again soon!`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800"
                            >
                              <MessageSquare className="h-3 w-3" /> WhatsApp
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* At-Risk Customer Churn Recovery */}
          {customerAnalytics.inactiveCustomers.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> Re-engage Inactive Customers
              </h3>
              <p className="text-xs text-muted-foreground">
                These regulars haven't shopped at your store in over 30 days. Send them a warm discount message to invite them back!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {customerAnalytics.inactiveCustomers.map((c, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-card border text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">Past Spend: ₹{c.totalSpent || 0}</p>
                    </div>
                    {c.phone && (
                      <a
                        href={`https://wa.me/91${c.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Dear ${c.name}! 🙏\nWe haven't seen you at ${shopData?.name || 'our store'} recently. Enjoy an exclusive 5% discount on your next visit!`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg"
                      >
                        Send Offer 🎁
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: KHATA & UDHAR RECOVERY ANALYTICS                                   */}
      {/* ========================================================================= */}
      {activeTab === 'udhar' && (
        <div className="space-y-6">
          {/* Udhar Health Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-rose-500" /> Udhar Given (Selected Period)
              </span>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                ₹{udharAnalytics.udharGiven.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Credit sales recorded</p>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-500" /> Udhar Recovered
              </span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{udharAnalytics.udharRecovered.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                {udharAnalytics.recoveryRate.toFixed(1)}% Recovery Rate
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> Total Store Outstanding
              </span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                ₹{udharAnalytics.totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">All pending customer balances</p>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-500" /> Pending Accounts
              </span>
              <p className="text-2xl font-black text-foreground mt-1">
                {customers.filter(c => (Number(c.balance) || 0) > 0).length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Customers with balance &gt; 0</p>
            </div>
          </div>

          {/* Highest Pending Udhar Customers */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-rose-500" /> Top Pending Udhar Accounts &amp; Quick Reminders
                </h3>
                <p className="text-xs text-muted-foreground">
                  Send WhatsApp payment reminder messages to recover store capital quickly.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {udharAnalytics.highestDefaulters.length === 0 ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center py-8 font-semibold col-span-3">
                  Awesome! Zero pending Udhar accounts. All customers have cleared their balance! 🎉
                </p>
              ) : (
                udharAnalytics.highestDefaulters.map((cust, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border bg-card space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-foreground">{cust.name}</p>
                        {cust.phone && <p className="text-[11px] text-muted-foreground font-mono">{cust.phone}</p>}
                      </div>
                      <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                        ₹{Number(cust.balance).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {cust.phone && (
                      <a
                        href={`https://wa.me/91${cust.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Dear ${cust.name}! 🙏\nThis is a gentle reminder that your pending balance at ${shopData?.name || 'our store'} is ₹${cust.balance}. Please clear it at your earliest convenience. Thank you!`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Send WhatsApp Reminder
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: BASKET AI & FREQUENTLY BOUGHT TOGETHER                             */}
      {/* ========================================================================= */}
      {activeTab === 'basket' && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" /> Market Basket AI: Frequently Bought Together
                </h3>
                <p className="text-xs text-muted-foreground">
                  AI scans customer invoices with 2+ items to discover product pairs frequently bought together.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {basketCombos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10 col-span-3">
                  Not enough multi-item bills yet to compute item pairings. As you scan more bills, AI combos will appear here automatically!
                </p>
              ) : (
                basketCombos.map((pair, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border bg-purple-50/20 dark:bg-purple-950/10 border-purple-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500 text-white">
                        Combo #{idx + 1}
                      </span>
                      <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                        {pair.count} times paired
                      </span>
                    </div>

                    <div className="space-y-1 pt-1">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="truncate">{pair.itemA}</span>
                      </p>
                      <p className="text-center text-[10px] text-muted-foreground font-black">+</p>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                        <span className="truncate">{pair.itemB}</span>
                      </p>
                    </div>

                    <p className="text-[10px] text-purple-700 dark:text-purple-300 pt-2 border-t border-purple-500/20">
                      💡 <strong>Action:</strong> Place these items close to each other on the shelf or offer a combo discount to boost sales!
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: D-MART DEMAND FORECASTING & FESTIVAL SURGE PLANNER                    */}
      {/* ========================================================================= */}
      {activeTab === 'forecasting' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Scenario & Multiplier Controls */}
          <div className="bg-gradient-to-r from-purple-500/10 via-primary/10 to-transparent border border-purple-500/20 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  D-Mart Demand Forecasting & Seasonal Surge Engine
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                  Prevent stockouts and shortages by accurately forecasting replenishment requirements based on past 30-day sales velocity, current inventory, and seasonal festival demand surges.
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-card border rounded-xl p-1 text-xs">
                  <span className="px-2 text-muted-foreground font-semibold text-[11px]">Horizon:</span>
                  {[
                    { days: 7, label: '7 Days' },
                    { days: 14, label: '14 Days' },
                    { days: 30, label: '30 Days' },
                  ].map(h => (
                    <button
                      key={h.days}
                      type="button"
                      onClick={() => setForecastHorizonDays(h.days)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        forecastHorizonDays === h.days
                          ? 'bg-primary text-primary-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-card border rounded-xl p-1 text-xs">
                  <span className="px-2 text-muted-foreground font-semibold text-[11px]">Scenario:</span>
                  {[
                    { mult: 1.0, label: 'Normal (1.0x)' },
                    { mult: 1.3, label: 'Month-Start (1.3x)' },
                    { mult: 2.0, label: 'Festival (2.0x)' },
                  ].map(s => (
                    <button
                      key={s.mult}
                      type="button"
                      onClick={() => setFestivalMultiplier(s.mult)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        festivalMultiplier === s.mult
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Stockout Imminent (&lt; 3 Days Runway)
              </span>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {demandForecasting.criticalCount} Products
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Will run out of stock in less than 72 hours</p>
            </div>

            <div className="bg-card border rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Reorder Suggested (3 - 7 Days Runway)
              </span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {demandForecasting.warningCount} Products
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Order now to ensure safe replenishment</p>
            </div>

            <div className="bg-card border rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                <IndianRupee className="h-4 w-4" /> Forecasted Restock Capital Required
              </span>
              <p className="text-2xl font-black text-foreground mt-1">
                ₹{demandForecasting.totalPOCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">For {forecastHorizonDays} days at {festivalMultiplier}x surge</p>
            </div>
          </div>

          {/* Forecast Matrix Table */}
          <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-muted/30">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Product-Wise Runway & Purchase Recommendations
              </h4>
              <span className="text-xs text-muted-foreground">
                Showing {demandForecasting.forecasts.length} items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase font-bold border-b text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-3 py-3 text-center">Current Stock</th>
                    <th className="px-3 py-3 text-center">Daily Sales Rate</th>
                    <th className="px-3 py-3 text-center">Stock Runway</th>
                    <th className="px-3 py-3 text-center">Projected Demand ({forecastHorizonDays}d)</th>
                    <th className="px-3 py-3 text-center">Suggested PO Qty</th>
                    <th className="px-4 py-3 text-right">Est. Cost (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {demandForecasting.forecasts.map(f => {
                    return (
                      <tr key={f.product.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <p className="font-bold text-foreground text-xs">{f.product.name}</p>
                          <span className="text-[10px] text-muted-foreground">{f.product.category || 'General'}</span>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-black text-xs ${
                            f.currentStock <= 0 
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400' 
                              : 'bg-muted text-foreground'
                          }`}>
                            {f.currentStock} {f.product.unit || 'pcs'}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center font-bold text-foreground">
                          {f.velocityPerDay.toFixed(1)} / day
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-black text-xs ${
                            f.urgency === 'critical'
                              ? 'bg-rose-500 text-white'
                              : f.urgency === 'warning'
                              ? 'bg-amber-500 text-white'
                              : f.urgency === 'excess'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {f.runwayDays > 100 ? '100+ days' : `${Math.round(f.runwayDays)} days left`}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center font-semibold text-foreground">
                          {f.projectedDemand} {f.product.unit || 'pcs'}
                        </td>

                        <td className="px-3 py-3 text-center">
                          {f.suggestedPOQty > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-xs bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                              +{f.suggestedPOQty} {f.product.unit || 'pcs'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Sufficient</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-black text-xs text-foreground">
                          {f.estPOCost > 0 ? `₹${f.estPOCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WHATSAPP EXECUTIVE SUMMARY MODAL                                          */}
      {/* ========================================================================= */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Share2 className="h-5 w-5 text-emerald-500" /> Store Executive Summary
              </h3>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/30 p-3 rounded-xl border font-mono text-xs whitespace-pre-wrap text-foreground">
              {generateWhatsAppSummary()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleCopySummary}
                className="text-xs gap-1.5"
              >
                {copiedSummary ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
                {copiedSummary ? 'Copied!' : 'Copy Text'}
              </Button>
              <Button
                onClick={handleSendWhatsAppSummary}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
              >
                <MessageSquare className="h-4 w-4" /> Open in WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
