import { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, DollarSign, PackageOpen, Loader2 } from 'lucide-react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Transaction, Product } from '../types';

const COLORS = ['#4f46e5', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

export default function Reports() {
  const { shopData } = useAuth();
  const [sales, setSales] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopData?.shopId) return;

    let salesLoaded = false;
    let productsLoaded = false;

    const salesQ = query(collection(db, 'shops', shopData.shopId, 'sales'));
    const unSubSales = onSnapshot(salesQ, (snapshot) => {
      const s: Transaction[] = [];
      snapshot.forEach(doc => s.push({ id: doc.id, ...doc.data() } as Transaction));
      setSales(s);
      salesLoaded = true;
      if (productsLoaded) setLoading(false);
    });

    const productsQ = query(collection(db, 'shops', shopData.shopId, 'products'));
    const unSubProducts = onSnapshot(productsQ, (snapshot) => {
      const p: Product[] = [];
      snapshot.forEach(doc => p.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(p);
      productsLoaded = true;
      if (salesLoaded) setLoading(false);
    });

    return () => {
      unSubSales();
      unSubProducts();
    };
  }, [shopData?.shopId]);

  // Derived Analytics Data
  const { totalRevenue, totalProfit, topProducts, dailySales } = useMemo(() => {
    let rev = 0;
    let profit = 0;
    
    // Product map for quick lookup
    const prodMap = new Map<string, Product>();
    products.forEach(p => prodMap.set(p.id, p));

    // Sales by day
    const daysMap = new Map<string, number>();
    
    // Item frequencies
    const itemMap = new Map<string, { name: string, qty: number, revenue: number }>();

    sales.forEach(sale => {
      rev += sale.totalAmount;
      
      const dateStr = new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daysMap.set(dateStr, (daysMap.get(dateStr) || 0) + sale.totalAmount);

      sale.items.forEach(item => {
        // Calculate profit if we know purchase price
        const dbProduct = prodMap.get(item.id);
        if (dbProduct && dbProduct.purchasePrice) {
          profit += ((item.sellingPrice || 0) - dbProduct.purchasePrice) * item.qty;
        }

        const existing = itemMap.get(item.id);
        if (existing) {
          existing.qty += item.qty;
          existing.revenue += (item.sellingPrice || 0) * item.qty;
        } else {
          itemMap.set(item.id, { 
            name: item.name, 
            qty: item.qty, 
            revenue: (item.sellingPrice || 0) * item.qty 
          });
        }
      });
    });

    const topProducts = Array.from(itemMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const dailySales = Array.from(daysMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7); // Last 7 days

    return { totalRevenue: rev, totalProfit: profit, topProducts, dailySales };
  }, [sales, products]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" /> AI Analytics
        </h1>
        <p className="text-muted-foreground">Deep insights into your store's performance.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card text-card-foreground p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 text-blue-600 dark:bg-blue-900/30 p-4 rounded-full">
            <DollarSign className="h-8 w-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
            <h3 className="text-3xl font-bold">₹{totalRevenue.toFixed(2)}</h3>
          </div>
        </div>
        <div className="bg-card text-card-foreground p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="bg-green-100 text-green-600 dark:bg-green-900/30 p-4 rounded-full">
            <TrendingUp className="h-8 w-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Est. Profit</p>
            <h3 className="text-3xl font-bold text-green-600 dark:text-green-500">₹{totalProfit.toFixed(2)}</h3>
          </div>
        </div>
        <div className="bg-card text-card-foreground p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="bg-purple-100 text-purple-600 dark:bg-purple-900/30 p-4 rounded-full">
            <PackageOpen className="h-8 w-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
            <h3 className="text-3xl font-bold">{sales.length}</h3>
          </div>
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground mt-8">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-semibold">No Sales Data Yet</h3>
          <p>Make some sales in the POS to see your analytics dashboard come alive!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Last 7 Days Revenue</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Top 5 Selling Items</h3>
            <div className="h-80 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topProducts}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {topProducts.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
