import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { 
  IndianRupee, ShoppingCart, TrendingUp, Users, Wallet,
  AlertTriangle, BrainCircuit, TrendingDown, PackageMinus, Download, Sparkles
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product, Transaction, Expense, Customer } from '../types';

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
  const navigate = useNavigate();
  
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
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <Button id="export-btn" onClick={handleExportCSV} className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md transition-all">
          <Download className="mr-2 h-4 w-4" /> Export Monthly Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Sales</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{todaysSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Today's revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Expenses</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">₹{todaysExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Today's expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">Net Profit (Today)</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">₹{(todaysSales - todaysExpenses).toFixed(2)}</div>
            <p className="text-xs text-primary/80">Sales - Expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaysOrders}</div>
            <p className="text-xs text-muted-foreground">Bills generated today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-1 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" /> AI Smart Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" /> Restock Urgently
              </h4>
              {aiInsights.restockItems.length > 0 ? (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {aiInsights.restockItems.map(p => (
                    <li key={p.id}>• {p.name} ({p.stock} left)</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Stock looks good!</p>
              )}
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" /> Top Value Items
              </h4>
              {aiInsights.trendingItems.length > 0 ? (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {aiInsights.trendingItems.map(p => (
                    <li key={p.id}>• {p.name} - ₹{Number(p.sellingPrice || 0).toFixed(2)}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Add products to see insights.</p>
              )}
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Expiring Soon
              </h4>
              {aiInsights.expiringItems.length > 0 ? (
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {aiInsights.expiringItems.map(p => (
                    <li key={p.id} className="text-red-500">
                      • {p.name} (Exp: {new Date(p.expiryDate!).toLocaleDateString()})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No items expiring soon.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-1 border-red-500/20 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Users className="h-5 w-5" /> Udhar Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Pending Udhar</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">₹{totalUdhar.toFixed(2)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">Customers in Udhar</p>
                  <p className="text-lg font-bold">{udharCustomersCount}</p>
                </div>
                <div className="bg-background rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">New Customers</p>
                  <p className="text-lg font-bold text-green-600">+{newCustomersToday}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
