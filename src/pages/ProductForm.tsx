import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Save, Loader2, RefreshCw, Camera } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
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
    expiryDate: ''
  });

  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (isEditing && shopData?.shopId && id) {
      const fetchProduct = async () => {
        try {
          const docRef = doc(db, 'shops', shopData.shopId, 'products', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as Product;
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
              expiryDate: data.expiryDate || ''
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
      };

      if (isEditing && id) {
        const docRef = doc(db, 'shops', shopData.shopId, 'products', id);
        await updateDoc(docRef, productData);
      } else {
        const productsRef = collection(db, 'shops', shopData.shopId, 'products');
        await addDoc(productsRef, {
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
                <Input id="name" value={formData.name} onChange={handleChange} placeholder="e.g. Amul Milk 500ml" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input id="category" value={formData.category} onChange={handleChange} placeholder="e.g. Dairy" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" value={formData.brand} onChange={handleChange} placeholder="e.g. Amul" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Input id="unit" value={formData.unit} onChange={handleChange} placeholder="e.g. pcs, kg, ltr" required />
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
                <Input id="sku" value={formData.sku} onChange={handleChange} placeholder="Leave empty to auto-generate" />
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
                      onClick={() => {
                        if (shopData?.plan === 'pro') {
                          setShowScanner(true);
                        } else {
                          if (confirm("Barcode scanning is a PRO feature. Upgrade to unlock!")) {
                            navigate('/upgrade');
                          }
                        }
                      }}
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
