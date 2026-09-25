import { useState, useEffect } from 'react';
import { ShoppingCart, Printer, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import type { Product } from '../types';

export default function Purchases() {
  const { shopData } = useAuth();
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopData?.shopId) return;

    const fetchLowStockProducts = async () => {
      try {
        const prods = await api.products.list();
        const lowStock = prods.filter((p: Product) => (p.stock || 0) <= (p.minStock || 0));
        setLowStockProducts(lowStock);
      } catch (err) {
        console.error('Failed to load products', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLowStockProducts();
  }, [shopData?.shopId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-primary" /> Auto-Shopping List
          </h1>
          <p className="text-muted-foreground mt-1">Products that have fallen below their minimum stock level.</p>
        </div>
        <Button onClick={handlePrint} disabled={lowStockProducts.length === 0} className="font-bold">
          <Printer className="h-4 w-4 mr-2" /> Print List
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12 print:hidden">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : lowStockProducts.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground print:hidden">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-semibold">Your inventory is fully stocked!</h3>
          <p>No products are currently below their minimum stock levels.</p>
        </div>
      ) : (
        <div className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden">
          {/* Print Header */}
          <div className="hidden print:block p-6 border-b text-center">
            <h2 className="text-2xl font-bold">{shopData?.shopName} - Purchase Order</h2>
            <p className="text-muted-foreground">Generated on: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-center">Current Stock</th>
                  <th className="px-6 py-4 text-center">Min Stock</th>
                  <th className="px-6 py-4">Qty to Buy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lowStockProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500 print:hidden" /> {product.name}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{product.category}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded font-bold text-xs">
                        {product.stock} {product.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-muted-foreground">{product.minStock} {product.unit}</td>
                    <td className="px-6 py-4">
                      {/* Empty box for physical writing on print out */}
                      <div className="border-b-2 border-dashed border-gray-400 w-16 h-6 inline-block print:border-black"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
