import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { 
  IndianRupee, 
  ShoppingCart, 
  TrendingUp, 
  Users,
  Wallet,
  AlertTriangle,
  BrainCircuit,
  Sparkles,
  TrendingDown,
  PackageMinus,
  Download
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Product, Transaction, Expense } from '../types';

const dummyData = [
  { name: 'Mon', sales: 4000 },
  { name: 'Tue', sales: 3000 },
  { name: 'Wed', sales: 2000 },
  { name: 'Thu', sales: 2780 },
  { name: 'Fri', sales: 1890 },
  { name: 'Sat', sales: 2390 },
  { name: 'Sun', sales: 3490 },
];

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
        // 1. Fetch Today's Sales
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString();

        const salesQuery = query(
          collection(db, 'shops', shopData.shopId, 'sales'),
          where('createdAt', '>=', todayStr)
        );
        const salesSnapshot = await getDocs(salesQuery);
        
        let salesTotal = 0;
        let orderCount = 0;
        
        salesSnapshot.forEach((doc) => {
          const data = doc.data() as Transaction;
          salesTotal += data.totalAmount || 0;
          orderCount++;
        });
        setTodaysSales(salesTotal);
        setTodaysOrders(orderCount);

        // 1.5 Fetch Today's Expenses
        const expenseQuery = query(
          collection(db, 'shops', shopData.shopId, 'expenses'),
          where('date', '==', today.toISOString().split('T')[0])
        );
        const expenseSnapshot = await getDocs(expenseQuery);
        let expensesTotal = 0;
        expenseSnapshot.forEach((doc) => {
          const data = doc.data() as Expense;
          expensesTotal += data.amount || 0;
        });
        setTodaysExpenses(expensesTotal);

        // 2. Fetch Customers Data (Total, Udhar, New Today)
        const customersQuery = query(collection(db, 'shops', shopData.shopId, 'customers'));
        const customersSnapshot = await getDocs(customersQuery);
        
        let custCount = 0;
        let udharTotal = 0;
        let udharCustCount = 0;
        let newCustTodayCount = 0;
        
        customersSnapshot.forEach((doc) => {
          custCount++;
          const data = doc.data();
          
          if (data.balance && data.balance > 0) {
            udharTotal += data.balance;
            udharCustCount++;
          }
          
          if (data.createdAt && data.createdAt >= todayStr) {
            newCustTodayCount++;
          }
        });

        setTotalCustomers(custCount);
        setTotalUdhar(udharTotal);
        setUdharCustomersCount(udharCustCount);
        setNewCustomersToday(newCustTodayCount);

        // 3. Fetch Low Stock Products
        const productsQuery = query(collection(db, 'shops', shopData.shopId, 'products'));
        const productsSnapshot = await getDocs(productsQuery);
        
        const lowStock: Product[] = [];
        const allProds: Product[] = [];
        productsSnapshot.forEach((doc) => {
          const product = { ...doc.data(), id: doc.id } as Product;
          allProds.push(product);
          const minStock = product.minStock || 5;
          if (product.stock <= minStock) {
            lowStock.push(product);
          }
        });

        setAllProducts(allProds);
        setLowStockItems(lowStock.sort((a, b) => a.stock - b.stock));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [shopData?.shopId]);

  const handleExportCSV = async () => {
    if (!shopData?.shopId) return;
    
    if (shopData.plan !== 'pro') {
      if (confirm("🔒 This is a PRO feature! Would you like to upgrade to Premium to download CA-ready reports?")) {
        navigate('/upgrade');
      }
      return;
    }

    try {
      // Just a quick visual indicator
      const btn = document.getElementById('export-btn');
      if (btn) btn.innerHTML = 'Exporting...';
      
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      
      const salesQuery = query(collection(db, 'shops', shopData.shopId, 'sales'), where('createdAt', '>=', firstDay));
      const expQuery = query(collection(db, 'shops', shopData.shopId, 'expenses'), where('date', '>=', firstDay.split('T')[0]));
      
      const [salesSnap, expSnap] = await Promise.all([getDocs(salesQuery), getDocs(expQuery)]);
      
      let csv = "Date,Type,Amount (Rs),Description / Customer\n";
      
      salesSnap.forEach(doc => {
        const d = doc.data() as Transaction;
        const dateStr = new Date(d.createdAt).toLocaleDateString('en-IN');
        csv += `${dateStr},Sale,${d.totalAmount},${d.customerPhone || 'Walk-in'}\n`;
      });
      
      expSnap.forEach(doc => {
        const d = doc.data() as Expense;
        csv += `${d.date},Expense,-${d.amount},${d.description || d.category}\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KiranaPro_Report_${today.toLocaleString('en-IN', { month: 'short' })}_${today.getFullYear()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      if (btn) btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg> Export Monthly Report';
    } catch(err) {
      console.error(err);
      alert('Failed to export report');
      const btn = document.getElementById('export-btn');
      if (btn) btn.innerHTML = 'Export Failed';
    }
  };
  // --- AI Insights Computation (Demo Logic) ---
  // In a real app, this would use an ML model or complex SQL grouping over past sales.
  const getAIInsights = () => {
    // Restock Prediction: Items running out soon
    const restockItems = allProducts.filter(p => p.stock <= (p.minStock || 5)).slice(0, 3);
    
    // Trending: Items with high price and low stock, or just some random top items
    const trendingItems = [...allProducts].sort((a, b) => (b.sellingPrice || 0) - (a.sellingPrice || 0)).slice(0, 2);
    
    // Dead Stock: Items with high stock
    const deadStock = [...allProducts].sort((a, b) => b.stock - a.stock).slice(0, 2);

    return { restockItems, trendingItems, deadStock };
  };

  const aiInsights = getAIInsights();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <Button 
          id="export-btn"
          onClick={handleExportCSV}
          className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md transition-all"
        >
          <Download className="mr-2 h-4 w-4" /> Export Monthly Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Sales
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{todaysSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Today's revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Expenses
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">₹{todaysExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Today's expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">
              Net Profit (Today)
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">₹{(todaysSales - todaysExpenses).toFixed(2)}</div>
            <p className="text-xs text-primary/80">Sales - Expenses</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-primary/10 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">
              AI Prediction: Trending
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            {shopData?.plan !== 'pro' && (
              <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-[2px] flex items-center justify-center rounded-xl cursor-pointer" onClick={() => navigate('/upgrade')}>
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow flex items-center gap-1">👑 Upgrade to View</span>
              </div>
            )}
            <div className={`space-y-2 ${shopData?.plan !== 'pro' ? 'opacity-30 blur-[2px] pointer-events-none' : ''}`}>
              {aiInsights.trendingItems.length > 0 ? aiInsights.trendingItems.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="truncate max-w-[120px] font-medium">{item.name}</span>
                  <span className="text-green-600 font-bold">₹{item.sellingPrice}</span>
                </div>
              )) : <div className="text-sm text-muted-foreground">No data yet</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">
              AI Alert: Restock
            </CardTitle>
            <PackageMinus className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent className="relative">
            {shopData?.plan !== 'pro' && (
              <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-[2px] flex items-center justify-center rounded-xl cursor-pointer" onClick={() => navigate('/upgrade')}>
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow flex items-center gap-1">👑 Upgrade to View</span>
              </div>
            )}
            <div className={`space-y-2 ${shopData?.plan !== 'pro' ? 'opacity-30 blur-[2px] pointer-events-none' : ''}`}>
              {aiInsights.restockItems.length > 0 ? aiInsights.restockItems.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="truncate max-w-[120px] font-medium text-orange-700">{item.name}</span>
                  <span className="text-red-500 font-bold">{item.stock} left</span>
                </div>
              )) : <div className="text-sm text-muted-foreground">Stock is healthy</div>}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Orders
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaysOrders}</div>
            <p className="text-xs text-muted-foreground">Bills generated today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">{newCustomersToday > 0 ? `+${newCustomersToday} new today` : 'All customers'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Udhar
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">₹{totalUdhar.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From {udharCustomersCount} customer{udharCustomersCount !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Smart Insights Section */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="col-span-3 bg-gradient-to-r from-indigo-900 to-purple-900 text-white border-none shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <BrainCircuit className="h-48 w-48 -mr-12 -mt-12" />
          </div>
          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-purple-300" /> 
              AI Smart Insights <span className="bg-purple-500/30 text-purple-200 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">Beta</span>
            </CardTitle>
            <p className="text-indigo-200 text-sm">Actionable predictions based on your shop's data</p>
          </CardHeader>
          <CardContent className="relative z-10 pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Trending */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-green-500/20 p-2 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <h3 className="font-bold text-green-400">Fast Moving (Trending)</h3>
              </div>
              <ul className="space-y-2">
                {aiInsights.trendingItems.length > 0 ? aiInsights.trendingItems.map(item => (
                  <li key={item.id} className="text-sm flex justify-between">
                    <span className="opacity-90">{item.name}</span>
                    <span className="font-mono text-green-300 font-bold">₹{item.sellingPrice}</span>
                  </li>
                )) : <li className="text-sm opacity-70">Not enough data yet.</li>}
              </ul>
            </div>

            {/* Restock Prediction */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-orange-500/20 p-2 rounded-lg">
                  <PackageMinus className="h-5 w-5 text-orange-400" />
                </div>
                <h3 className="font-bold text-orange-400">Restock Soon</h3>
              </div>
              <ul className="space-y-2">
                {aiInsights.restockItems.length > 0 ? aiInsights.restockItems.map(item => (
                  <li key={item.id} className="text-sm flex justify-between">
                    <span className="opacity-90">{item.name}</span>
                    <span className="text-orange-300 text-xs bg-orange-500/20 px-2 py-0.5 rounded-md">Only {item.stock} left</span>
                  </li>
                )) : <li className="text-sm opacity-70">Stock levels are good!</li>}
              </ul>
            </div>

            {/* Dead Stock */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-red-500/20 p-2 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
                <h3 className="font-bold text-red-400">Dead Stock (Not Selling)</h3>
              </div>
              <ul className="space-y-2">
                {aiInsights.deadStock.length > 0 ? aiInsights.deadStock.map(item => (
                  <li key={item.id} className="text-sm flex justify-between items-center">
                    <span className="opacity-90 truncate max-w-[120px]">{item.name}</span>
                    <span className="text-red-300 text-xs bg-red-500/20 px-2 py-0.5 rounded-md">{item.stock} units stuck</span>
                  </li>
                )) : <li className="text-sm opacity-70">No dead stock found.</li>}
              </ul>
            </div>

          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Weekly Sales Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dummyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="stroke-primary"
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading alerts...</p>
              ) : lowStockItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">All stock levels look good!</p>
              ) : (
                lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center space-x-3">
                    <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/20">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Min required: {item.minStock || 5}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{item.stock}</p>
                    <p className="text-xs text-muted-foreground">in stock</p>
                  </div>
                </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
