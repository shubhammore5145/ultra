import { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, DollarSign, PackageOpen, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../lib/api';
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

    const fetchData = async () => {
      try {
        const [salesData, productsData] = await Promise.all([
          api.transactions.list(),
          api.products.list()
        ]);
        setSales(salesData);
        setProducts(productsData);
      } catch (err) {
        console.error('Failed to load report data', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
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
      rev += Number(sale.totalAmount || 0);
      
      const dateStr = new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daysMap.set(dateStr, (daysMap.get(dateStr) || 0) + Number(sale.totalAmount || 0));

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
    <div className="space-y-6 animate-fadeInUp">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" /> Analytics & Reports
          </h1>
          <p className="page-subtitle">Deep insights into your store performance</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
        <div className="stat-card flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="stat-label">Total Revenue</p>
            <p className="stat-value">₹{totalRevenue.toFixed(2)}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="stat-label">Estimated Profit</p>
            <p className="stat-value text-emerald-600">₹{totalProfit.toFixed(2)}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center flex-shrink-0">
            <PackageOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="stat-label">Total Transactions</p>
            <p className="stat-value">{sales.length}</p>
          </div>
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="kirana-card">
          <div className="empty-state">
            <div className="empty-state-icon"><BarChart3 className="h-8 w-8" /></div>
            <p className="empty-state-title">No Sales Data Yet</p>
            <p className="empty-state-desc">Make some sales in the POS to see your analytics come alive!</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="kirana-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold">Last 7 Days Revenue</h3>
            </div>
            <div className="p-5">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySales} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '10px', fontSize: '13px' }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Products Pie */}
          <div className="kirana-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold">Top 5 Selling Items</h3>
            </div>
            <div className="p-5">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={topProducts} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3}>
                      {topProducts.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '10px', fontSize: '13px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
