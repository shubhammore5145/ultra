import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Save, Loader2, RefreshCw, Camera, Wand2, Sparkles, TrendingUp, Layers, Hash } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product } from '../types';
import { CameraScanner } from '../components/CameraScanner';
import { compressImage } from '../lib/imageCompressor';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { shopData } = useAuth();
  const isEditing = !!id;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    brand: '',
    unit: 'pcs',
    purchasePrice: '',
    sellingPrice: '',
    mrp: '',
    gst: '0',
    stock: '',
    minStock: '5',
    sku: '',
    barcode: '',
    shortCode: '',
    isLoose: false,
    expiryDate: '',
    imageUrl: '',
    wholesalePrice: '',
    bulkMinQty: '',
    bulkPrice: '',
    rackLocation: '',
    reorderQty: '',
    maxStock: ''
  });

  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (isEditing && shopData?.shopId && id) {
      const fetchProduct = async () => {
        try {
          const products = await api.products.list();
          const data = products.find((p: Product) => p.id === id);
          if (data) {
            setFormData({
              name: data.name || '',
              category: data.category || '',
              brand: data.brand || '',
              unit: data.unit || 'pcs',
              purchasePrice: data.purchasePrice?.toString() || '',
              sellingPrice: data.sellingPrice?.toString() || '',
              mrp: data.mrp?.toString() || '',
              gst: data.gst?.toString() || '0',
              stock: data.stock?.toString() || '',
              minStock: data.minStock?.toString() || '5',
              sku: data.sku || '',
              barcode: data.barcode || '',
              shortCode: data.shortCode || '',
              isLoose: Boolean(data.isLoose) || (!data.barcode && !!data.shortCode),
              expiryDate: data.expiryDate || '',
              imageUrl: data.imageUrl || '',
              wholesalePrice: data.wholesalePrice?.toString() || '',
              bulkMinQty: data.bulkMinQty?.toString() || '',
              bulkPrice: data.bulkPrice?.toString() || '',
              rackLocation: data.rackLocation || '',
              reorderQty: data.reorderQty?.toString() || '',
              maxStock: data.maxStock?.toString() || ''
            });
          }
        } catch (err) {
          console.error(err);
          setError('Failed to fetch product details.');
        } finally {
          setInitialLoading(false);
        }
      };
      fetchProduct();
    }
  }, [isEditing, id, shopData?.shopId]);

  useEffect(() => {
    if (formData.barcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, formData.barcode, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
        });
      } catch (e: any) {
        console.error('Invalid barcode', e);
      }
    }
  }, [formData.barcode]);

  const generateBarcode = () => {
    const random = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData({ ...formData, barcode: random });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError('');
      try {
        const compressedBase64 = await compressImage(file, 800, 800, 0.75);
        setFormData(prev => ({ ...prev, imageUrl: compressedBase64 }));
      } catch (err: any) {
        console.error('Image compression error:', err);
        setError('Failed to process image');
      }
    }
  };

  const generateSmartSKU = () => {
    if (!formData.name) return;
    const cat = (formData.category || 'GEN').substring(0, 3).toUpperCase();
    const brnd = (formData.brand || 'XXX').substring(0, 3).toUpperCase();
    const nm = formData.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
    const random = Math.floor(100 + Math.random() * 900);
    setFormData(prev => ({ ...prev, sku: `${cat}-${brnd}-${nm}-${random}` }));
  };

  const aiSuggestDetails = () => {
    if (!formData.name) return;
    const nameLower = formData.name.toLowerCase();
    
    let suggestedCategory = formData.category;
    let suggestedBrand = formData.brand;
    let suggestedUnit = formData.unit;

    if (nameLower.includes('milk') || nameLower.includes('paneer') || nameLower.includes('curd')) {
      suggestedCategory = 'Dairy';
      suggestedUnit = nameLower.includes('milk') ? 'ltr' : 'kg';
    } else if (nameLower.includes('rice') || nameLower.includes('daal') || nameLower.includes('dal')) {
      suggestedCategory = 'Grains & Pulses';
      suggestedUnit = 'kg';
    } else if (nameLower.includes('soap') || nameLower.includes('shampoo')) {
      suggestedCategory = 'Personal Care';
      suggestedUnit = 'pcs';
    } else if (nameLower.includes('chips') || nameLower.includes('biscuit')) {
      suggestedCategory = 'Snacks';
      suggestedUnit = 'pcs';
    }

    if (nameLower.includes('amul')) suggestedBrand = 'Amul';
    else if (nameLower.includes('tata')) suggestedBrand = 'Tata';
    else if (nameLower.includes('britannia')) suggestedBrand = 'Britannia';
    else if (nameLower.includes('parle')) suggestedBrand = 'Parle';

    setFormData(prev => ({
      ...prev,
      category: suggestedCategory || prev.category,
      brand: suggestedBrand || prev.brand,
      unit: suggestedUnit || prev.unit
    }));
  };

  const calculateMargin = () => {
    const pp = Number(formData.purchasePrice) || 0;
    const sp = Number(formData.sellingPrice) || 0;
    if (pp > 0 && sp > 0) {
      const profit = sp - pp;
      const margin = (profit / sp) * 100;
      return { profit, margin };
    }
    return null;
  };

  const marginData = calculateMargin();

  const handleAutoShortCode = async () => {
    try {
      const products = await api.products.list();
      const existingCodes = products
        .map((p: any) => parseInt(p.shortCode || p.barcode, 10))
        .filter((n: number) => !isNaN(n) && n > 0 && n < 10000);
      const nextCode = existingCodes.length > 0 ? (Math.max(...existingCodes) + 1).toString() : '1';
      setFormData(prev => ({ 
        ...prev, 
        shortCode: nextCode,
        barcode: prev.barcode || nextCode
      }));
    } catch (e) {
      setFormData(prev => ({ ...prev, shortCode: '1', barcode: prev.barcode || '1' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.shopId) {
      setError('Shop data not found. Please relogin.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const finalBarcode = formData.barcode.trim() || (formData.isLoose && formData.shortCode ? formData.shortCode.trim() : '');

      const productData = {
        shopId: shopData.shopId,
        name: formData.name,
        category: formData.category,
        brand: formData.brand,
        unit: formData.unit,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        mrp: parseFloat(formData.mrp) || 0,
        gst: parseFloat(formData.gst) || 0,
        stock: parseFloat(formData.stock) || 0,
        minStock: parseFloat(formData.minStock) || 0,
        sku: formData.sku,
        barcode: finalBarcode,
        shortCode: formData.shortCode?.trim() || null,
        isLoose: formData.isLoose ? 1 : 0,
        expiryDate: formData.expiryDate || null,
        imageUrl: formData.imageUrl || null,
        wholesalePrice: formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : undefined,
        bulkMinQty: formData.bulkMinQty ? parseFloat(formData.bulkMinQty) : undefined,
        bulkPrice: formData.bulkPrice ? parseFloat(formData.bulkPrice) : undefined,
        rackLocation: formData.rackLocation.trim() || undefined,
        reorderQty: formData.reorderQty ? parseFloat(formData.reorderQty) : undefined,
        maxStock: formData.maxStock ? parseFloat(formData.maxStock) : undefined
      };

      if (isEditing && id) {
        await api.products.update(id, productData);
      } else {
        await api.products.create({
          id: crypto.randomUUID(),
          ...productData,
          createdAt: new Date().toISOString()
        });
      }
      
      navigate('/products');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save product');
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/products')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {isEditing ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fill in the product details below.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-sm text-destructive border border-destructive/20 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Details */}
          <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm md:col-span-2">
            <h2 className="text-lg font-semibold">Basic Details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <div className="flex gap-2">
                  <Input id="name" value={formData.name} onChange={handleChange} placeholder="e.g. Amul Milk 500ml" required />
                  <Button type="button" variant="outline" size="icon" onClick={aiSuggestDetails} title="AI Auto-fill Details">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <select 
                  id="category" 
                  value={formData.category} 
                  onChange={(e: any) => handleChange(e)} 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="" disabled>Select Category</option>
                  <option value="Dairy">Dairy & Milk</option>
                  <option value="Snacks">Snacks & Biscuits</option>
                  <option value="Beverages">Beverages & Drinks</option>
                  <option value="Grains & Pulses">Grains & Pulses</option>
                  <option value="Spices">Spices & Masalas</option>
                  <option value="Personal Care">Personal Care</option>
                  <option value="Home Care">Home Care</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" value={formData.brand} onChange={handleChange} placeholder="e.g. Amul" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <select 
                  id="unit" 
                  value={formData.unit} 
                  onChange={(e: any) => handleChange(e)} 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="gm">Gram (gm)</option>
                  <option value="ltr">Liter (ltr)</option>
                  <option value="ml">Milliliter (ml)</option>
                  <option value="pkt">Packet (pkt)</option>
                  <option value="box">Box</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="imageUpload">Product Image</Label>
                <div className="flex items-center gap-4">
                  {formData.imageUrl && (
                    <div className="h-16 w-16 rounded-md overflow-hidden border">
                      <img src={formData.imageUrl} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          id="imageUpload" 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          className="cursor-pointer"
                        />
                      </div>
                      <div className="relative">
                        <Input 
                          id="cameraUpload" 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          onChange={handleImageUpload} 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        />
                        <Button type="button" variant="outline" className="flex gap-2 relative z-0">
                          <Camera className="h-4 w-4" /> Camera
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Upload or capture product photo (Auto-compressed under 100 KB)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Loose / Non-Barcode Item Section */}
          <div className={`rounded-xl border p-6 shadow-sm md:col-span-2 transition-all duration-200 ${
            formData.isLoose 
              ? 'bg-amber-500/10 border-amber-500/40 dark:bg-amber-950/20 dark:border-amber-700/50' 
              : 'bg-card'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${formData.isLoose ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    Loose / Non-Barcode Grocery Item
                    {formData.isLoose && <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">Active</span>}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    For items without barcodes such as sugar, rice, grains, pulses, and spices.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.isLoose} 
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      isLoose: checked,
                      unit: checked && prev.unit === 'pcs' ? 'kg' : prev.unit
                    }));
                    if (checked && !formData.shortCode) {
                      handleAutoShortCode();
                    }
                  }} 
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {formData.isLoose && (
              <div className="mt-4 pt-4 border-t border-amber-500/20 grid gap-4 md:grid-cols-2 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="shortCode" className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                      <Hash className="h-4 w-4 text-amber-600" /> Shortcut Code / POS Number (e.g. 1, 2, 3...) *
                    </Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50"
                      onClick={handleAutoShortCode}
                    >
                      <Sparkles className="h-3 w-3 mr-1" /> Auto Number
                    </Button>
                  </div>
                  <Input 
                    id="shortCode" 
                    value={formData.shortCode} 
                    onChange={handleChange} 
                    placeholder="e.g. 1, 2, 3, 101..." 
                    className="font-black text-xl bg-white dark:bg-card border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100" 
                  />
                  <p className="text-xs text-amber-800 dark:text-amber-300/80 leading-relaxed">
                    💡 <strong>Fast Billing:</strong> In POS billing, type <strong>"{formData.shortCode || '1'}"</strong> and press Enter to instantly add this item to cart!
                  </p>
                </div>

                <div className="rounded-xl bg-white/60 dark:bg-black/20 p-4 border border-amber-500/20 text-xs space-y-2 flex flex-col justify-center">
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    🏪 Grocery Store Advantage:
                  </p>
                  <p className="text-muted-foreground">
                    • Quickly sell unpackaged items with single-digit short codes without scanning barcodes.
                  </p>
                  <p className="text-muted-foreground">
                    • These items also appear as 1-click Quick Buttons at the top of POS billing.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Pricing & Stock */}
          <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm md:col-span-2">
            <h2 className="text-lg font-semibold">Pricing & Inventory</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Purchase Price (₹) *</Label>
                <Input id="purchasePrice" value={formData.purchasePrice} onChange={handleChange} type="number" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellingPrice">Selling Price (₹) *</Label>
                <Input id="sellingPrice" value={formData.sellingPrice} onChange={handleChange} type="number" step="0.01" required />
                {marginData && (
                  <p className={`text-xs flex items-center ${marginData.profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Profit: ₹{marginData.profit.toFixed(2)} ({marginData.margin.toFixed(1)}% margin)
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mrp">MRP (₹)</Label>
                <Input id="mrp" value={formData.mrp} onChange={handleChange} type="number" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gst">GST %</Label>
                <Input id="gst" value={formData.gst} onChange={handleChange} type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Opening Stock *</Label>
                <Input id="stock" value={formData.stock} onChange={handleChange} type="number" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Min Stock Alert</Label>
                <Input id="minStock" value={formData.minStock} onChange={handleChange} type="number" />
              </div>
            </div>
          </div>

          {/* D-Mart Dynamic Pricing & Warehouse Location */}
          <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 font-black text-xs uppercase tracking-wider">D-Mart</span>
                  Dynamic Pricing & Warehouse Rack Placement
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set wholesale rates, bulk quantity discounts, rack/shelf positions, and automatic replenishment reorder levels.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="wholesalePrice" className="text-sm font-semibold">
                  Wholesale Price (थोक किंमत ₹)
                </Label>
                <Input 
                  id="wholesalePrice" 
                  value={formData.wholesalePrice} 
                  onChange={handleChange} 
                  type="number" 
                  step="0.01" 
                  placeholder="e.g. 95.00"
                />
                <p className="text-[11px] text-muted-foreground">Rate applied when wholesale mode is active in POS.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulkMinQty" className="text-sm font-semibold">
                  Bulk Tier Min Qty (किमान नग)
                </Label>
                <Input 
                  id="bulkMinQty" 
                  value={formData.bulkMinQty} 
                  onChange={handleChange} 
                  type="number" 
                  placeholder="e.g. 5 or 10"
                />
                <p className="text-[11px] text-muted-foreground">Min quantity to trigger automatic bulk discount.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulkPrice" className="text-sm font-semibold">
                  Bulk Unit Price (बल्क प्रति नग दर ₹)
                </Label>
                <Input 
                  id="bulkPrice" 
                  value={formData.bulkPrice} 
                  onChange={handleChange} 
                  type="number" 
                  step="0.01" 
                  placeholder="e.g. 90.00"
                />
                <p className="text-[11px] text-muted-foreground">Auto-applied in cart when item quantity reaches min qty.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rackLocation" className="text-sm font-semibold">
                  Warehouse Rack / Shelf (रॅक स्थान)
                </Label>
                <Input 
                  id="rackLocation" 
                  value={formData.rackLocation} 
                  onChange={handleChange} 
                  placeholder="e.g. Rack A-3, Shelf 2, Cold Storage"
                />
                <p className="text-[11px] text-muted-foreground">Shown during billing and physical stock audits.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reorderQty" className="text-sm font-semibold">
                  Auto Reorder Qty (पुन्हा मागवण्याचे प्रमाण)
                </Label>
                <Input 
                  id="reorderQty" 
                  value={formData.reorderQty} 
                  onChange={handleChange} 
                  type="number" 
                  placeholder="e.g. 50 or 100"
                />
                <p className="text-[11px] text-muted-foreground">Suggested replenishment order size when stock drops below min.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxStock" className="text-sm font-semibold">
                  Max Stock Limit (कमाल मर्यादा)
                </Label>
                <Input 
                  id="maxStock" 
                  value={formData.maxStock} 
                  onChange={handleChange} 
                  type="number" 
                  placeholder="e.g. 200"
                />
                <p className="text-[11px] text-muted-foreground">Prevents overstocking and dead capital accumulation.</p>
              </div>
            </div>
          </div>

          {/* Barcode & Extra */}
          <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm md:col-span-2">
            <h2 className="text-lg font-semibold">Barcode & Codes</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU Code</Label>
                <div className="flex gap-2">
                  <Input id="sku" value={formData.sku} onChange={handleChange} placeholder="e.g. DAIRY-AMU-MILK-123" />
                  <Button type="button" variant="outline" size="icon" onClick={generateSmartSKU} title="Auto-generate Smart SKU">
                    <Wand2 className="h-4 w-4 text-purple-500" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input id="expiryDate" type="date" value={formData.expiryDate} onChange={handleChange} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="barcode">Barcode</Label>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-3 text-xs" 
                      onClick={() => setShowScanner(true)}
                    >
                      <Camera className="mr-1 h-3 w-3" /> Scan Camera
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-3 text-xs text-primary" onClick={generateBarcode}>
                      <RefreshCw className="mr-1 h-3 w-3" /> Generate
                    </Button>
                  </div>
                </div>
                <Input 
                  id="barcode" 
                  value={formData.barcode}
                  onChange={handleChange}
                  placeholder={formData.isLoose ? `Optional (Short code "${formData.shortCode || '1'}" will be used)` : "Scan or enter barcode"} 
                />
                {formData.isLoose && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    ℹ️ For loose items without barcodes, leave blank — shortcut code <strong>{formData.shortCode || '1'}</strong> will be used automatically.
                  </p>
                )}
              </div>
              {formData.barcode && (
                <div id="barcode-label-area" className="md:col-span-2 flex flex-col items-center justify-center p-4 border rounded-lg bg-white mt-2">
                  <svg ref={barcodeRef}></svg>
                  <p className="text-xs font-semibold text-black mt-1 mb-2">{formData.name || 'Product'}</p>
                  <p className="text-sm font-bold text-black">₹{formData.sellingPrice || '0'}</p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => {
                      const printWindow = window.open('', '', 'width=300,height=200');
                      const el = document.getElementById('barcode-label-area');
                      if (printWindow && el) {
                        printWindow.document.write(`<html><head><title>Print Label</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;">${el.innerHTML}</body></html>`);
                        printWindow.document.close();
                        printWindow.focus();
                        printWindow.print();
                        printWindow.close();
                      }
                    }}
                  >
                    🖨️ Print Label
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 border-t pt-6">
          <Button type="button" variant="outline" onClick={() => navigate('/products')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Product
          </Button>
        </div>
      </form>
      
      {showScanner && (
        <CameraScanner 
          onScan={(code) => {
            setFormData(prev => ({ ...prev, barcode: code }));
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
