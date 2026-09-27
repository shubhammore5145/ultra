import { useState, useEffect } from 'react';
import { 
  IndianRupee, ShoppingCart, TrendingUp, Users, Wallet,
  AlertTriangle, Download, Sparkles
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product, Transaction, Expense, Customer } from '../types';

export default function Dashboard() {
  const { shopData } = useAuth();
  
  const [todaysSales, setTodaysSales] = useState(0);
  const [todaysExpenses, setTodaysExpenses] = useState(0);
  const [todaysOrders, setTodaysOrders] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalUdhar, setTotalUdhar] = useState(0);
  const [udharCustomersCount, setUdharCustomersCount] = useState(0);
  const [newCustomersToday, setNewCustomersToday] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopData?.shopId) return;

    const fetchDashboardData = async () => {
      try {
        const today = new Date();
        const isToday = (dateString: string) => {
          if (!dateString) return false;
          const d = new Date(dateString);
          return d.getDate() === today.getDate() &&
                 d.getMonth() === today.getMonth() &&
                 d.getFullYear() === today.getFullYear();
        };
        
        const [products, transactions, expenses, customers] = await Promise.all([
          api.products.list(),
          api.transactions.list(),
          api.expenses.list(),
          api.customers.list()
        ]);

        // Products & Low Stock
        setAllProducts(products);
        const lowStock = products.filter((p: Product) => p.stock <= (p.minStock || 5));
        setLowStockItems(lowStock.sort((a: Product, b: Product) => a.stock - b.stock));

        // Sales (Today)
        let salesTotal = 0;
        let orderCount = 0;
        transactions.forEach((t: Transaction) => {
          if (isToday(t.createdAt)) {
            salesTotal += Number(t.totalAmount) || 0;
            orderCount++;
          }
        });
        setTodaysSales(salesTotal);
        setTodaysOrders(orderCount);

        // Expenses (Today)
        let expensesTotal = 0;
        expenses.forEach((e: Expense) => {
          if (isToday(e.date)) {
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
      }
    };

    fetchDashboardData();
  }, [shopData?.shopId]);

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
        <button
          id="export-btn"
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors"
        >
          <Download className="h-4 w-4" /> Export Report
        </button>
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
          <p className="text-xs text-muted-foreground mt-1">Total revenue today</p>
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
          <p className="text-xs text-muted-foreground mt-1">Bills generated</p>
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
