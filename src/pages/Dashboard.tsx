import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  IndianRupee, 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  AlertTriangle 
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
import type { Product, Transaction } from '../types';

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
  const [todaysOrders, setTodaysOrders] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalUdhar, setTotalUdhar] = useState(0);
  const [udharCustomersCount, setUdharCustomersCount] = useState(0);
  const [newCustomersToday, setNewCustomersToday] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
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
        productsSnapshot.forEach((doc) => {
          const product = doc.data() as Product;
          const minStock = product.minStock || 5;
          if (product.stock <= minStock) {
            lowStock.push({ ...product, id: doc.id });
          }
        });

        setLowStockItems(lowStock);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [shopData?.shopId]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
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
