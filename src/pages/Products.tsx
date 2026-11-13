import { useState, useEffect, useMemo, useRef } from 'react';
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
  Save,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product } from '../types';
import { CameraScanner } from '../components/CameraScanner';

export default function Products() {
  const { shopData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Bulk Edit State
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [editedProducts, setEditedProducts] = useState<Record<string, Partial<Product>>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Scanner State
  const [showScanner, setShowScanner] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // CSV Import State
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const navigate = useNavigate();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await api.products.list();
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        console.warn('api.products.list() did not return an array:', data);
        setProducts([]);
      }
    } catch (err) {
      console.error('Failed to load products', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [shopData?.shopId]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(products)) {
      products.forEach(p => {
        if (p.category) set.add(p.category);
      });
    }
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter(p => {
      const matchesSearch = 
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.barcode || '').includes(searchTerm) ||
        (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Pagination slicing
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handleDelete = async (id: string) => {
    const prod = products.find(p => p.id === id);
    if (window.confirm(`Are you sure you want to move "${prod?.name || 'this product'}" to Recycle Bin?`)) {
      try {
        await api.products.delete(id, prod);
        setProducts(prev => prev.filter(p => p.id !== id));
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

      await fetchProducts();
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

  // CSV Export
  const handleExportCSV = () => {
    if (products.length === 0) {
      alert('No products to export.');
      return;
    }

    const headers = ['Name', 'Category', 'Brand', 'Unit', 'PurchasePrice', 'SellingPrice', 'MRP', 'GST', 'Stock', 'MinStock', 'Barcode', 'SKU'];
    const rows = products.map(p => [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      `"${(p.brand || '').replace(/"/g, '""')}"`,
      `"${p.unit || 'pcs'}"`,
      p.purchasePrice || 0,
      p.sellingPrice || 0,
      p.mrp || 0,
      p.gst || 0,
      p.stock || 0,
      p.minStock || 5,
      `"${p.barcode || ''}"`,
      `"${p.sku || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `products_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const headers = ['Name', 'Category', 'Brand', 'Unit', 'PurchasePrice', 'SellingPrice', 'MRP', 'GST', 'Stock', 'MinStock', 'Barcode', 'SKU'];
    const sample = [
      'Amul Taaza Milk 500ml,Dairy,Amul,pkt,27,30,30,0,50,10,8901262010053,DAIRY-AMU-001',
      'Parle-G Biscuit 250g,Snacks,Parle,pkt,22,25,25,0,100,20,8901719101037,SNACK-PAR-002',
      'Tata Salt 1kg,Grains & Pulses,Tata,kg,24,28,28,0,40,10,8901030000000,GRN-TAT-003'
    ];
    const csv = [headers.join(','), ...sample].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'products_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          alert('CSV file is empty or missing data rows.');
          setImporting(false);
          return;
        }

        // Header check
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const nameIdx = headers.indexOf('name');
        const catIdx = headers.indexOf('category');
        const brandIdx = headers.indexOf('brand');
        const unitIdx = headers.indexOf('unit');
        const ppIdx = headers.indexOf('purchaseprice');
        const spIdx = headers.indexOf('sellingprice');
        const mrpIdx = headers.indexOf('mrp');
        const gstIdx = headers.indexOf('gst');
        const stockIdx = headers.indexOf('stock');
        const minStockIdx = headers.indexOf('minstock');
        const barcodeIdx = headers.indexOf('barcode');
        const skuIdx = headers.indexOf('sku');

        if (nameIdx === -1 || spIdx === -1) {
          alert('CSV must contain at least "Name" and "SellingPrice" columns.');
          setImporting(false);
          return;
        }

        let addedCount = 0;
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          const name = row[nameIdx];
          if (!name) continue;

          const productData = {
            id: crypto.randomUUID(),
            name,
            category: catIdx > -1 ? row[catIdx] : 'General',
            brand: brandIdx > -1 ? row[brandIdx] : '',
            unit: unitIdx > -1 ? row[unitIdx] : 'pcs',
            purchasePrice: ppIdx > -1 ? parseFloat(row[ppIdx]) || 0 : 0,
            sellingPrice: spIdx > -1 ? parseFloat(row[spIdx]) || 0 : 0,
            mrp: mrpIdx > -1 ? parseFloat(row[mrpIdx]) || 0 : 0,
            gst: gstIdx > -1 ? parseFloat(row[gstIdx]) || 0 : 0,
            stock: stockIdx > -1 ? parseFloat(row[stockIdx]) || 0 : 0,
            minStock: minStockIdx > -1 ? parseFloat(row[minStockIdx]) || 5 : 5,
            barcode: barcodeIdx > -1 ? row[barcodeIdx] : '',
            sku: skuIdx > -1 ? row[skuIdx] : '',
          };

          await api.products.create(productData);
          addedCount++;
        }

        alert(`🎉 Successfully imported ${addedCount} products from CSV!`);
        await fetchProducts();
      } catch (err: any) {
        console.error('CSV Import Error:', err);
        alert('Failed to import CSV: ' + (err.message || 'Unknown error'));
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Products & Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your shop's stock, prices, barcodes, and bulk import/export.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bulkEditMode ? (
            <Button size="sm" onClick={handleSaveBulkEdits} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-bold">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          ) : (
            <>
              {/* CSV Import */}
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
              <Button 
                variant="outline" 
                size="sm" 
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/30"
              >
                {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                Import CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportCSV}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <Download className="mr-1.5 h-4 w-4" /> Export CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setBulkEditMode(true)} 
                className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <Edit className="mr-1.5 h-4 w-4" /> Bulk Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchProducts()} 
                disabled={loading}
                className="text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Reload products from server"
              >
                <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
              </Button>
              <Button size="sm" onClick={() => navigate('/products/new')} className="font-bold">
                <Plus className="mr-1.5 h-4 w-4" /> Add Product
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/30">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, barcode, SKU..."
              className="pl-9 bg-background"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="flex w-full md:w-auto items-center gap-3">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All Categories ({products.length})</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Camera Barcode Quick Search */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-1.5"
              title="Scan barcode to find product"
            >
              <Barcode className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Scan to Search</span>
            </Button>
          </div>
        </div>

        {/* Products Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Product Details</th>
                <th className="px-6 py-3.5 font-semibold">Category</th>
                <th className="px-6 py-3.5 font-semibold">Price</th>
                <th className="px-6 py-3.5 font-semibold">Stock</th>
                <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                    Loading products...
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="font-semibold text-base text-foreground">No products found</p>
                    <p className="text-xs mt-1 max-w-sm mx-auto">
                      {searchTerm ? 'Try adjusting your search query or clear category filters.' : 'No products found in your inventory. Click the button below to add products or refresh.'}
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => fetchProducts()} disabled={loading}>
                        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                      </Button>
                      <Button size="sm" onClick={() => navigate('/products/new')} className="font-bold">
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> + Add Product
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-white">
                            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border bg-muted text-muted-foreground text-xs font-bold">
                            {product.name ? product.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                            <span>{product.name}</span>
                            {(product as any).isLoose ? (
                              <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                                Loose Item
                              </span>
                            ) : null}
                            {(product as any).shortCode ? (
                              <span className="bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 text-[10px] font-black px-1.5 py-0.5 rounded border border-purple-300 dark:border-purple-700">
                                ⚡ Code: {(product as any).shortCode}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                            {product.brand && <span>Brand: {product.brand}</span>}
                            {product.barcode && <span>• Bar: {product.barcode}</span>}
                            {(product as any).shortCode && <span>• POS Code: {(product as any).shortCode}</span>}
                            {product.sku && <span>• SKU: {product.sku}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {product.category || 'General'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-bold">
                      {bulkEditMode ? (
                        <div className="w-24">
                          <Input 
                            type="number" 
                            className="h-8 text-xs font-bold" 
                            defaultValue={product.sellingPrice} 
                            onChange={(e) => handleBulkChange(product.id, 'sellingPrice', Number(e.target.value))}
                          />
                        </div>
                      ) : (
                        `₹${Number(product.sellingPrice || 0).toFixed(2)}`
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {bulkEditMode ? (
                        <div className="w-20">
                          <Input 
                            type="number" 
                            className="h-8 text-xs font-bold" 
                            defaultValue={product.stock} 
                            onChange={(e) => handleBulkChange(product.id, 'stock', Number(e.target.value))}
                          />
                        </div>
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          Number(product.stock || 0) > Number(product.minStock || 5) ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          Number(product.stock || 0) > 0 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                          'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}>
                          {product.stock || 0} {product.unit || 'units'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => navigate(`/products/${product.id}`)}
                          title="Edit product"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(product.id)}
                          title="Delete product"
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
        
        {/* Pagination Controls */}
        <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground bg-muted/10">
          <div>
            Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <span className="text-xs font-medium px-2">Page {currentPage} of {totalPages}</span>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* CSV Sample Template helper hint */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-card border rounded-lg p-3">
        <span>Need a pre-formatted template for uploading your product catalog in Excel/CSV?</span>
        <button 
          onClick={handleDownloadTemplate} 
          className="text-primary font-bold hover:underline flex items-center gap-1"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Download Sample CSV Template
        </button>
      </div>

      {/* Camera Barcode Quick Search Modal */}
      {showScanner && (
        <CameraScanner 
          onScan={(code) => {
            setSearchTerm(code);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
