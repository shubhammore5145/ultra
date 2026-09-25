import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload,
  Edit,
  Trash,
  Barcode,
  Loader2,
  Save
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product } from '../types';

export default function Products() {
  const { shopData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Bulk Edit State
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [editedProducts, setEditedProducts] = useState<Record<string, Partial<Product>>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    if (!shopData?.shopId) return;

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
    
    fetchProducts();
  }, [shopData?.shopId]);

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode || '').includes(searchTerm) ||
    (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!shopData?.shopId) return;
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await api.products.delete(id);
        setProducts(products.filter(p => p.id !== id));
      } catch (error) {
        console.error('Failed to delete product', error);
        alert('Failed to delete product');
      }
    }
  };

  const handleBulkChange = (id: string, field: keyof Product, value: any) => {
    setEditedProducts(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSaveBulkEdits = async () => {
    const idsToUpdate = Object.keys(editedProducts);
    if (idsToUpdate.length === 0) {
      setBulkEditMode(false);
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all(idsToUpdate.map(async (id) => {
        const changes = editedProducts[id];
        const originalProduct = products.find(p => p.id === id);
        if (originalProduct) {
          const updatedProduct = { ...originalProduct, ...changes };
          await api.products.update(id, updatedProduct);
        }
      }));

      // Refresh products
      const data = await api.products.list();
      setProducts(data);
      setEditedProducts({});
      setBulkEditMode(false);
      alert('Prices and Stock updated successfully!');
    } catch (err) {
      console.error('Failed to save bulk edits', err);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your shop's inventory and barcodes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bulkEditMode ? (
            <Button size="sm" onClick={handleSaveBulkEdits} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setBulkEditMode(true)} className="hidden md:flex text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                <Edit className="mr-2 h-4 w-4" /> Bulk Edit
              </Button>
              <Button size="sm" onClick={() => navigate('/products/new')}>
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-4 border-b flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products, barcode, SKU..."
              className="pl-8 bg-white dark:bg-gray-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex w-full md:w-auto items-center gap-2">
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Barcode className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 font-medium">Product Details</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading products...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-white">
                            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border bg-muted/50 text-muted-foreground text-xs font-medium">
                            {product.name ? product.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-foreground">
                            {product.name}
                          </div>
                          <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                            <span>SKU: {product.sku || 'N/A'}</span>
                            <span>•</span>
                            <span>Bar: {product.barcode || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {product.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {bulkEditMode ? (
                        <div className="flex flex-col gap-1 w-24">
                          <Input 
                            type="number" 
                            className="h-7 text-xs" 
                            defaultValue={product.sellingPrice} 
                            onChange={(e) => handleBulkChange(product.id, 'sellingPrice', Number(e.target.value))}
                          />
                        </div>
                      ) : (
                        `₹${Number(product.sellingPrice || 0).toFixed(2)}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {bulkEditMode ? (
                        <Input 
                          type="number" 
                          className="h-7 text-xs w-20" 
                          defaultValue={product.stock} 
                          onChange={(e) => handleBulkChange(product.id, 'stock', Number(e.target.value))}
                        />
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          Number(product.stock || 0) > Number(product.minStock || 5) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          Number(product.stock || 0) > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {product.stock || 0} {product.unit || 'units'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => navigate(`/products/${product.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <div>Showing {filteredProducts.length} entries</div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm" disabled>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
