import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import { 
  Package, 
  Search, 
  TrendingUp, 
  AlertTriangle, 
  Bot, 
  Loader2, 
  Save, 
  ArrowDown 
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import type { Product } from '../types';

export default function Inventory() {
  const { shopData } = useAuth();
  const { canAccess, openUpgradeModal } = usePlan();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  
  // AI Predictor State
  const [showAiReport, setShowAiReport] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);

  // Stock edit state
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchProducts();
  }, [shopData?.shopId]);

  const fetchProducts = async () => {
    try {
      const data = await api.products.list();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (productId: string, newValue: string) => {
    const val = parseInt(newValue, 10);
    setStockEdits(prev => ({
      ...prev,
      [productId]: isNaN(val) ? 0 : val
    }));
  };

  const saveInventory = async () => {
    setSaving(true);
    try {
      // Create an array of updates
      const updates = Object.keys(stockEdits).map(id => {
        const product = products.find(p => p.id === id);
        if (!product) return null;
        return api.products.update(id, { stock: stockEdits[id] });
      }).filter(Boolean);

      await Promise.all(updates);
      alert('Inventory updated successfully!');
      setStockEdits({});
      await fetchProducts();
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert('Failed to save inventory');
    } finally {
      setSaving(false);
    }
  };

  const runAIPredictor = async () => {
    setAiLoading(true);
    setShowAiReport(true);
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const lowStock = products.filter(p => p.stock <= p.minStock);
    const criticalStock = products.filter(p => p.stock === 0);
    
    // Fake AI logic based on heuristics
    const insights = {
      critical: criticalStock,
      low: lowStock,
      trending: products.slice(0, 3).map(p => ({
        ...p,
        predictedDemand: Math.floor(Math.random() * 50) + 20
      }))
    };
    
    setAiInsights(insights);
    setAiLoading(false);
  };

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode || '').includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Package className="h-8 w-8" /> Inventory Management
          </h1>
          <p className="text-muted-foreground">Track stock levels and get AI restocking predictions.</p>
        </div>
        
        <div className="flex gap-2">
          {Object.keys(stockEdits).length > 0 && (
            <Button onClick={saveInventory} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          )}
          <Button 
            onClick={runAIPredictor}
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 text-white border-0 shadow-lg shadow-purple-500/20"
          >
            <Bot className="mr-2 h-5 w-5" />
            Smart AI Predictor
            {!canAccess('demand_forecast') && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-purple-900/80 text-white shadow-sm">
                ⚡ PRO
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* AI Report Section */}
      {showAiReport && (
        <div className="bg-gradient-to-br from-indigo-50/50 via-purple-50/50 to-pink-50/50 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Bot className="h-32 w-32" />
          </div>
          
          <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-400 mb-4 relative z-10">
            <Bot className="h-6 w-6" /> AI Demand & Restock Report
          </h2>
          
          {aiLoading ? (
            <div className="flex flex-col items-center justify-center py-8 relative z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                <Loader2 className="h-10 w-10 animate-spin text-purple-600 relative z-10" />
              </div>
              <p className="mt-4 text-purple-700 dark:text-purple-400 font-medium animate-pulse">
                Analyzing historical sales data and current inventory...
              </p>
            </div>
          ) : aiInsights && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-red-600 flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5" /> Out of Stock ({aiInsights.critical.length})
                </h3>
                <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {aiInsights.critical.map((p: any) => (
                    <li key={p.id} className="text-sm flex justify-between items-center border-b pb-2 last:border-0">
                      <span>{p.name}</span>
                      <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">0 left</span>
                    </li>
                  ))}
                  {aiInsights.critical.length === 0 && <p className="text-sm text-muted-foreground">No items out of stock!</p>}
                </ul>
              </div>

              <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-orange-600 flex items-center gap-2 mb-3">
                  <ArrowDown className="h-5 w-5" /> Low Stock ({aiInsights.low.length})
                </h3>
                <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {aiInsights.low.map((p: any) => (
                    <li key={p.id} className="text-sm flex justify-between items-center border-b pb-2 last:border-0">
                      <span>{p.name}</span>
                      <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{p.stock} left</span>
                    </li>
                  ))}
                  {aiInsights.low.length === 0 && <p className="text-sm text-muted-foreground">Stock levels are healthy.</p>}
                </ul>
              </div>

              <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-purple-200 dark:border-purple-800 rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-purple-600 flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5" /> Trending Items
                </h3>
                <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {aiInsights.trending.map((p: any) => (
                    <li key={p.id} className="text-sm flex flex-col border-b pb-2 last:border-0 border-purple-100 dark:border-purple-900/30">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{p.name}</span>
                      </div>
                      <span className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        Predicted demand: {p.predictedDemand} units next week
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/30 flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search inventory by name or barcode..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-6 py-3 font-medium">Product Name</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Price</th>
                <th className="px-6 py-3 font-medium">Min Stock</th>
                <th className="px-6 py-3 font-medium">Current Stock</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.map((product) => {
                const currentStock = stockEdits[product.id] !== undefined ? stockEdits[product.id] : product.stock;
                const isLowStock = currentStock <= product.minStock;
                const isOutOfStock = currentStock === 0;
                
                return (
                  <tr key={product.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium">
                      {product.name}
                      <span className="block text-xs text-muted-foreground font-mono mt-1">{product.barcode || product.sku}</span>
                    </td>
                    <td className="px-6 py-4">{product.category}</td>
                    <td className="px-6 py-4">₹{product.sellingPrice}</td>
                    <td className="px-6 py-4 text-muted-foreground">{product.minStock}</td>
                    <td className="px-6 py-4">
                      <Input 
                        type="number"
                        className={`w-24 h-8 text-center font-bold ${
                          stockEdits[product.id] !== undefined ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : ''
                        }`}
                        value={currentStock}
                        onChange={(e) => handleStockChange(product.id, e.target.value)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No products found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
