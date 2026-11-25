import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
  RefreshCw,
  IndianRupee,
  TrendingUp,
  X,
  CheckCircle2,
  Check,
  Sparkles,
  Trash2,
  Tag,
  FolderPlus
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product } from '../types';
import { CameraScanner } from '../components/CameraScanner';

export default function Products() {
  const { shopData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('pos_products_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  
  // Bulk Edit State
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [editedProducts, setEditedProducts] = useState<Record<string, Partial<Product>>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Quick Price Change Modal State
  const [priceModalProduct, setPriceModalProduct] = useState<Product | null>(null);
  const [modalPurchasePrice, setModalPurchasePrice] = useState<string>('');
  const [modalSellingPrice, setModalSellingPrice] = useState<string>('');
  const [modalMrp, setModalMrp] = useState<string>('');
  const [modalBulkMinQty, setModalBulkMinQty] = useState<string>('');
  const [modalBulkPrice, setModalBulkPrice] = useState<string>('');
  const [modalPackTotalStr, setModalPackTotalStr] = useState<string>('');
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceSuccessMsg, setPriceSuccessMsg] = useState<string | null>(null);

  // Category Management State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categorySuccessMsg, setCategorySuccessMsg] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('martgpt_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const openPriceModal = (product: Product) => {
    setPriceModalProduct(product);
    setModalPurchasePrice(product.purchasePrice !== undefined && product.purchasePrice !== null ? String(product.purchasePrice) : '');
    setModalSellingPrice(product.sellingPrice !== undefined && product.sellingPrice !== null ? String(product.sellingPrice) : '');
    setModalMrp(product.mrp !== undefined && product.mrp !== null ? String(product.mrp) : '');
    setModalBulkMinQty(product.bulkMinQty ? String(product.bulkMinQty) : '');
    setModalBulkPrice(product.bulkPrice ? String(product.bulkPrice) : '');
    setModalPackTotalStr(
      Number(product.bulkMinQty) > 0 && Number(product.bulkPrice) > 0
        ? String(Math.round(Number(product.bulkMinQty) * Number(product.bulkPrice) * 100) / 100)
        : ''
    );
    setPriceSuccessMsg(null);
  };

  const handleSaveProductPrice = async () => {
    if (!priceModalProduct) return;
    setPriceSaving(true);
    try {
      const pp = parseFloat(modalPurchasePrice) || 0;
      const sp = parseFloat(modalSellingPrice) || 0;
      const mrpVal = parseFloat(modalMrp) || 0;
      const bMin = modalBulkMinQty ? parseFloat(modalBulkMinQty) : null;
      const bPrice = modalBulkPrice ? parseFloat(modalBulkPrice) : null;

      await api.products.update(priceModalProduct.id, {
        purchasePrice: pp,
        sellingPrice: sp,
        mrp: mrpVal,
        bulkMinQty: bMin,
        bulkPrice: bPrice
      });

      // Update local products state immediately
      setProducts(prev => prev.map(p => {
        if (p.id === priceModalProduct.id) {
          return {
            ...p,
            purchasePrice: pp,
            sellingPrice: sp,
            mrp: mrpVal,
            bulkMinQty: bMin ?? undefined,
            bulkPrice: bPrice ?? undefined
          };
        }
        return p;
      }));

      setPriceSuccessMsg(`Prices updated successfully! (Cost: ₹${pp.toFixed(2)}, Selling: ₹${sp.toFixed(2)})`);
      setTimeout(() => {
        setPriceSuccessMsg(null);
        setPriceModalProduct(null);
      }, 700);
    } catch (err: any) {
      console.error('Failed to update product price:', err);
      alert('Failed to update price: ' + (err.message || 'Unknown error'));
    } finally {
      setPriceSaving(false);
    }
  };

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
      if (Array.isArray(data) && data.length > 0) {
        setProducts(data);
        try {
          localStorage.setItem('pos_products_cache', JSON.stringify(data));
        } catch {}
      } else {
        // Fallback to local cache if API returns empty
        try {
          const cached = localStorage.getItem('pos_products_cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setProducts(parsed);
              return;
            }
          }
        } catch {}
        if (Array.isArray(data)) {
          setProducts(data);
        }
      }
    } catch (err) {
      console.error('Failed to load products', err);
      try {
        const cached = localStorage.getItem('pos_products_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
            return;
          }
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [shopData?.shopId]);

  // Extract unique categories (combining products + custom categories)
  const categories = useMemo(() => {
    const set = new Set<string>();
    customCategories.forEach(c => set.add(c));
    if (Array.isArray(products)) {
      products.forEach(p => {
        if (p.category) set.add(p.category);
      });
    }
    return Array.from(set).sort();
  }, [products, customCategories]);

  const handleCreateCategory = (catName?: string) => {
    const targetName = (catName || newCategoryInput).trim();
    if (!targetName) return;

    const updated = Array.from(new Set([...customCategories, targetName]));
    setCustomCategories(updated);
    try {
      localStorage.setItem('martgpt_custom_categories', JSON.stringify(updated));
    } catch {}

    setSelectedCategory(targetName);
    setCategorySuccessMsg(`Category "${targetName}" created & filter applied!`);
    setNewCategoryInput('');
    setTimeout(() => {
      setShowCategoryModal(false);
      setCategorySuccessMsg('');
    }, 800);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    const updated = customCategories.filter(c => c !== catToDelete);
    setCustomCategories(updated);
    try {
      localStorage.setItem('martgpt_custom_categories', JSON.stringify(updated));
    } catch {}
    if (selectedCategory === catToDelete) {
      setSelectedCategory('all');
    }
  };

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const term = searchTerm.trim().toLowerCase();
    const words = term.split(/\s+/).filter(Boolean);

    return products.filter(p => {
      let matchesSearch = true;
      if (term) {
        const pName = (p.name || '').toLowerCase();
        const pBrand = (p.brand || '').toLowerCase();
        const pCategory = (p.category || '').toLowerCase();
        const pBarcode = (p.barcode || '').toLowerCase();
        const pSku = (p.sku || '').toLowerCase();
        const pShortCode = ((p as any).shortCode ? String((p as any).shortCode) : '').toLowerCase();

        if (pShortCode === term || pBarcode === term) {
          matchesSearch = true;
        } else if (pBrand && (pBrand === term || pBrand.includes(term))) {
          matchesSearch = true;
        } else {
          const combined = `${pName} ${pBrand} ${pCategory} ${pBarcode} ${pSku} ${pShortCode}`;
          matchesSearch = words.every(w => combined.includes(w));
        }
      }
      
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
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => { setBulkEditMode(false); setEditedProducts({}); }}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSaveBulkEdits} 
                disabled={isSaving} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes {Object.keys(editedProducts).length > 0 ? `(${Object.keys(editedProducts).length})` : ''}
              </Button>
            </div>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCategoryModal(true)}
                className="h-9 px-2.5 text-xs font-bold gap-1 text-primary border-primary/30 hover:bg-primary/10"
                title="Add & Manage Categories"
              >
                <FolderPlus className="h-3.5 w-3.5" /> + Category
              </Button>
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

        {/* Bulk Edit Notice Banner */}
        {bulkEditMode && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                <strong>⚡ Bulk Edit Active:</strong> You can edit <strong>Cost Price (CP)</strong>, <strong>Selling Price (SP)</strong>, and <strong>Stock</strong> directly in the table rows below.
              </span>
            </div>
            <span className="font-bold bg-blue-200/70 dark:bg-blue-900 px-2.5 py-0.5 rounded text-[11px]">
              {Object.keys(editedProducts).length} Products Modified
            </span>
          </div>
        )}

        {/* Products Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Product Details</th>
                <th className="px-4 py-3.5 font-semibold">Category</th>
                <th className="px-4 py-3.5 font-semibold">Cost Price (CP)</th>
                <th className="px-4 py-3.5 font-semibold">Selling Price (SP)</th>
                <th className="px-4 py-3.5 font-semibold">Margin / Profit</th>
                <th className="px-4 py-3.5 font-semibold">Stock</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                    Loading products...
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
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
                    <td className="px-5 py-3.5">
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
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {product.category || 'General'}
                      </span>
                    </td>

                    {/* Purchase Price (Cost) */}
                    <td className="px-4 py-3.5">
                      {bulkEditMode ? (
                        <div className="w-24">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">₹</span>
                            <Input 
                              type="number" 
                              step="0.01"
                              className="h-8 pl-5 text-xs font-bold bg-background" 
                              defaultValue={product.purchasePrice || ''} 
                              placeholder="0.00"
                              onChange={(e) => handleBulkChange(product.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPriceModal(product)}
                          className="group flex items-center gap-1.5 text-left hover:bg-muted/70 px-2 py-1 -mx-2 rounded-lg transition-colors cursor-pointer"
                          title="Click to edit cost & selling prices"
                        >
                          <span className="font-bold text-muted-foreground text-xs sm:text-sm group-hover:text-primary">
                            ₹{Number(product.purchasePrice || 0).toFixed(2)}
                          </span>
                          <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 text-primary transition-opacity shrink-0" />
                        </button>
                      )}
                    </td>

                    {/* Selling Price */}
                    <td className="px-4 py-3.5">
                      {bulkEditMode ? (
                        <div className="w-24">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-bold">₹</span>
                            <Input 
                              type="number" 
                              step="0.01"
                              className="h-8 pl-5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-background" 
                              defaultValue={product.sellingPrice || ''} 
                              placeholder="0.00"
                              onChange={(e) => handleBulkChange(product.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPriceModal(product)}
                          className="group text-left hover:bg-muted/70 px-2 py-1 -mx-2 rounded-lg transition-colors cursor-pointer block"
                          title="Click to edit cost & selling prices"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-foreground text-sm group-hover:text-primary">
                              ₹{Number(product.sellingPrice || 0).toFixed(2)}
                            </span>
                            <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 text-primary transition-opacity shrink-0" />
                          </div>
                          {Number(product.mrp || 0) > Number(product.sellingPrice || 0) && (
                            <span className="text-[10px] text-muted-foreground line-through block">
                              MRP: ₹{Number(product.mrp).toFixed(2)}
                            </span>
                          )}
                          {Number(product.bulkMinQty || 0) > 0 && Number(product.bulkPrice || 0) > 0 && (
                            <span className="inline-block mt-0.5 text-[10px] font-black bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                              📦 {product.bulkMinQty}+ : ₹{Number(Number(product.bulkPrice).toFixed(2))}/pc
                            </span>
                          )}
                        </button>
                      )}
                    </td>

                    {/* Margin / Profit */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {(() => {
                        const sp = Number(product.sellingPrice || 0);
                        const pp = Number(product.purchasePrice || 0);
                        if (sp <= 0 && pp <= 0) return <span className="text-xs text-muted-foreground">—</span>;
                        const profit = sp - pp;
                        const marginPercent = pp > 0 ? (profit / pp) * 100 : (sp > 0 ? 100 : 0);
                        if (pp <= 0) {
                          return (
                            <button 
                              type="button" 
                              onClick={() => openPriceModal(product)} 
                              className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline"
                              title="Set purchase cost price"
                            >
                              + Set Cost Price
                            </button>
                          );
                        }
                        if (profit > 0) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                              <TrendingUp className="h-3 w-3 text-emerald-600" />
                              +₹{profit.toFixed(2)} ({marginPercent.toFixed(0)}%)
                            </span>
                          );
                        }
                        if (profit < 0) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                              -₹{Math.abs(profit).toFixed(2)} (Loss)
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-muted text-muted-foreground">
                            ₹0.00 (Zero Margin)
                          </span>
                        );
                      })()}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3.5">
                      {bulkEditMode ? (
                        <div className="w-20">
                          <Input 
                            type="number" 
                            className="h-8 text-xs font-bold bg-background" 
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

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                          onClick={() => openPriceModal(product)}
                          title="Quick Price Change"
                        >
                          <IndianRupee className="h-3.5 w-3.5 mr-1" />
                          Edit Price
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => navigate(`/products/${product.id}`)}
                          title="Edit full product details"
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

      {/* QUICK PRICE CHANGE MODAL */}
      {priceModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <IndianRupee className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-tight">
                    Update Purchase & Selling Price
                  </h3>
                  <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                    {priceModalProduct.name}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setPriceModalProduct(null); setPriceSuccessMsg(null); }} 
                className="rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {priceSuccessMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{priceSuccessMsg}</span>
                </div>
              )}

              {/* Product Info Pill */}
              <div className="p-2.5 bg-muted/50 rounded-xl flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Current In-Stock:</span>
                <span className="font-bold text-foreground">
                  {priceModalProduct.stock || 0} {priceModalProduct.unit || 'units'}
                </span>
              </div>

              {/* Purchase Price Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-foreground">
                    Cost Price (Purchase Price / CP):
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Supplier acquisition rate</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={modalPurchasePrice}
                    onChange={(e) => setModalPurchasePrice(e.target.value)}
                    className="pl-7 h-11 text-base font-bold bg-background"
                    autoFocus
                  />
                </div>
              </div>

              {/* Selling Price Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-foreground">
                    Selling Price (Retail Billing Rate / SP):
                  </Label>
                  <span className="text-[11px] text-emerald-600 font-bold">Customer billing price</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-emerald-600 font-bold">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={modalSellingPrice}
                    onChange={(e) => setModalSellingPrice(e.target.value)}
                    className="pl-7 h-11 text-lg font-black bg-background border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300"
                  />
                </div>
              </div>

              {/* MRP Input (Optional) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium text-muted-foreground">
                    MRP (Maximum Retail Price - Optional):
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Package printed rate</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={modalMrp}
                    onChange={(e) => setModalMrp(e.target.value)}
                    className="pl-7 h-9 text-xs font-medium bg-background"
                  />
                </div>
              </div>

              {/* Pack / Bulk Pricing Quick Setup */}
              <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                    📦 पॅक ऑफर दर (Pack / Bulk Rate - Optional)
                  </Label>
                  {(modalBulkMinQty || modalBulkPrice || modalPackTotalStr) && (
                    <button
                      type="button"
                      onClick={() => { setModalBulkMinQty(''); setModalBulkPrice(''); setModalPackTotalStr(''); }}
                      className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground block mb-1">पॅक नग (Qty)</span>
                    <Input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="उदा. 6"
                      value={modalBulkMinQty}
                      onChange={(e) => {
                        const rawQty = e.target.value;
                        setModalBulkMinQty(rawQty);
                        const q = parseFloat(rawQty) || 0;
                        const t = parseFloat(modalPackTotalStr) || 0;
                        if (q > 0 && t > 0) {
                          setModalBulkPrice(String(Math.round((t / q) * 10000) / 10000));
                        }
                      }}
                      className="h-8 text-xs font-bold bg-background"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground block mb-1">पॅक एकूण (₹)</span>
                    <Input
                      type="number"
                      step="any"
                      placeholder="उदा. 180"
                      disabled={!parseFloat(modalBulkMinQty)}
                      value={modalPackTotalStr}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setModalPackTotalStr(raw);
                        const qty = parseFloat(modalBulkMinQty) || 0;
                        const totalVal = parseFloat(raw);
                        if (!raw || isNaN(totalVal) || qty <= 0) {
                          setModalBulkPrice('');
                          return;
                        }
                        setModalBulkPrice(String(Math.round((totalVal / qty) * 10000) / 10000));
                      }}
                      className="h-8 text-xs font-bold bg-background text-indigo-700 dark:text-indigo-300"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground block mb-1">प्रति नग (₹)</span>
                    <Input
                      type="number"
                      step="any"
                      placeholder="उदा. 30"
                      value={modalBulkPrice}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setModalBulkPrice(raw);
                        const unitVal = parseFloat(raw);
                        const qty = parseFloat(modalBulkMinQty) || 0;
                        if (!raw || isNaN(unitVal) || qty <= 0) {
                          setModalPackTotalStr('');
                        } else {
                          setModalPackTotalStr(String(Math.round(unitVal * qty * 100) / 100));
                        }
                      }}
                      className="h-8 text-xs font-bold bg-background text-emerald-700 dark:text-emerald-300"
                    />
                  </div>
                </div>
              </div>

              {/* Live Profit & Margin Calculation Card */}
              {(() => {
                const pp = parseFloat(modalPurchasePrice) || 0;
                const sp = parseFloat(modalSellingPrice) || 0;
                const mrpVal = parseFloat(modalMrp) || 0;
                const profit = sp - pp;
                const marginPercent = pp > 0 ? (profit / pp) * 100 : (sp > 0 ? 100 : 0);
                const discount = mrpVal > sp ? mrpVal - sp : 0;

                if (pp > 0 || sp > 0) {
                  return (
                    <div className={`p-3 rounded-xl border space-y-1.5 ${
                      profit > 0 
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' 
                        : profit < 0 
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                        : 'bg-muted/50 border-muted'
                    }`}>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-muted-foreground">Estimated Profit per Unit:</span>
                        <span className={`text-sm font-black ${profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : profit < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                          {profit > 0 ? `+₹${profit.toFixed(2)}` : profit < 0 ? `-₹${Math.abs(profit).toFixed(2)} (Loss)` : '₹0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                        <span>Profit Margin:</span>
                        <span className="font-bold text-foreground">{marginPercent.toFixed(1)}%</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-dashed">
                          <span>Customer Discount on MRP:</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">₹{discount.toFixed(2)} OFF</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-muted/20 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-1/3 h-10 font-bold text-xs"
                onClick={() => { setPriceModalProduct(null); setPriceSuccessMsg(null); }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="w-2/3 h-10 font-black text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                disabled={priceSaving || (!modalSellingPrice && !modalPurchasePrice)}
                onClick={handleSaveProductPrice}
              >
                {priceSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                )}
                Save Price Changes
              </Button>
            </div>
          </div>
        </div>
      )}

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

      {/* Category Creation & Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card text-card-foreground border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Categories Manager</h3>
                  <p className="text-xs text-muted-foreground">Create and manage product categories for your store</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => { setShowCategoryModal(false); setCategorySuccessMsg(''); }}
                className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Success feedback */}
            {categorySuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-in fade-in">
                <Check className="h-4 w-4" />
                <span>{categorySuccessMsg}</span>
              </div>
            )}

            {/* Input to Create Category */}
            <div className="space-y-2">
              <Label className="text-xs font-bold">Create New Category:</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="e.g. Ice Cream, Pooja Samagri, Dry Fruits..."
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCategory();
                    }
                  }}
                  className="text-xs font-medium"
                  autoFocus
                />
                <Button
                  type="button"
                  onClick={() => handleCreateCategory()}
                  disabled={!newCategoryInput.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Category
                </Button>
              </div>
            </div>

            {/* Quick 1-Click Indian Kirana Category Suggestions */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Popular Indian Kirana Categories (1-Click Add):
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: 'Edible Oils & Ghee', icon: '🛢️' },
                  { name: 'Atta, Rice & Dal', icon: '🌾' },
                  { name: 'Dry Fruits & Nuts', icon: '🥜' },
                  { name: 'Namkeen & Farsan', icon: '🥨' },
                  { name: 'Pooja Samagri', icon: '🪔' },
                  { name: 'Ice Cream & Frozen', icon: '🍦' },
                  { name: 'Cleaning & Detergents', icon: '🧼' },
                  { name: 'Biscuits & Cookies', icon: '🍪' },
                  { name: 'Cold Drinks & Juices', icon: '🧃' },
                  { name: 'Patanjali & Ayurvedic', icon: '🌿' },
                  { name: 'Noodles & Instant Food', icon: '🍝' },
                  { name: 'Chocolates & Sweets', icon: '🍫' }
                ].map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleCreateCategory(item.name)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-all border border-muted-foreground/20 flex items-center gap-1"
                  >
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* All Active Store Categories with Product Counts */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs font-bold text-muted-foreground">
                All Active Store Categories ({categories.length}):
              </Label>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                {categories.map(cat => {
                  const count = products.filter(p => p.category === cat).length;
                  const isCustom = customCategories.includes(cat);
                  return (
                    <div 
                      key={cat} 
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        selectedCategory === cat 
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs' 
                          : 'bg-card text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      <button 
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat);
                          setShowCategoryModal(false);
                        }}
                        className="hover:underline flex items-center gap-1"
                      >
                        <span>{cat}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          selectedCategory === cat ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {count}
                        </span>
                      </button>
                      {isCustom && count === 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(cat);
                          }}
                          title={`Delete unused category ${cat}`}
                          className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedCategory('all'); setShowCategoryModal(false); }}
                className="text-xs font-semibold text-muted-foreground"
              >
                Clear Filter (Show All)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setShowCategoryModal(false); setCategorySuccessMsg(''); }}
                className="text-xs font-bold"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
