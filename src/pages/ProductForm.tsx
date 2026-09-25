import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Save, Loader2, RefreshCw, Camera, Wand2, Sparkles, TrendingUp } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product } from '../types';
import { CameraScanner } from '../components/CameraScanner';

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
    expiryDate: '',
    imageUrl: ''
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
              expiryDate: data.expiryDate || '',
              imageUrl: data.imageUrl || ''
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Image must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.shopId) {
      setError('Shop data not found. Please relogin.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const productData = {
        name: formData.name,
        category: formData.category,
        brand: formData.brand,
        unit: formData.unit,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        mrp: parseFloat(formData.mrp) || 0,
        gst: parseFloat(formData.gst) || 0,
        stock: parseInt(formData.stock, 10) || 0,
        minStock: parseInt(formData.minStock, 10) || 0,
        sku: formData.sku,
        barcode: formData.barcode,
        expiryDate: formData.expiryDate || null,
        imageUrl: formData.imageUrl || null,
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
                    <p className="text-xs text-muted-foreground">Upload or capture product photo (max 2MB)</p>
                  </div>
                </div>
              </div>
            </div>
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
                  placeholder="Scan or enter barcode" 
                />
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
