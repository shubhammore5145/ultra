import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Search, Plus, Minus, Trash, Users, IndianRupee, FileText, ShoppingCart, Loader2, X, CheckCircle2, MessageCircle, QrCode, Mic, Camera } from 'lucide-react';
import { collection, query, onSnapshot, writeBatch, doc, addDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Product, CartItem } from '../types';
import { CameraScanner } from '../components/CameraScanner';

export default function POS() {
  const { shopData } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Voice Search State
  const [isListening, setIsListening] = useState(false);
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const voiceSupported = !!SpeechRecognition;

  // Quick Add State
  const [quickAddBarcode, setQuickAddBarcode] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPrice, setQuickAddPrice] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  // Checkout Success State
  const [checkoutResult, setCheckoutResult] = useState<{ id: string, total: number, items: CartItem[] } | null>(null);

  // Camera Scanner State
  const [showScanner, setShowScanner] = useState(false);

  // Fetch live products for fast POS search
  useEffect(() => {
    if (!shopData?.shopId) return;

    const q = query(collection(db, 'shops', shopData.shopId, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [shopData?.shopId]);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  }, []);

  const handleBarcodeScan = useCallback((barcode: string) => {
    // If the quick add modal is open, don't trigger another scan
    if (quickAddBarcode) return;

    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product);
    } else {
      // Open Quick Add Modal
      setQuickAddBarcode(barcode);
      setQuickAddName('');
      setQuickAddPrice('');
    }
  }, [products, quickAddBarcode, addToCart]);

  const barcodeBufferRef = useRef('');
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global barcode listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If we are typing in an input other than search, don't capture as barcode
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' && activeElement !== searchInputRef.current) {
        return;
      }

      if (e.key === 'Enter' && barcodeBufferRef.current) {
        console.log('[Scanner] Enter key pressed! Full barcode:', barcodeBufferRef.current);
        // We have a complete barcode scan
        handleBarcodeScan(barcodeBufferRef.current);
        barcodeBufferRef.current = '';
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }
      } else if (e.key.length === 1) {
        // Accumulate characters
        barcodeBufferRef.current += e.key;
        console.log('[Scanner] Key received:', e.key, '| Buffer so far:', barcodeBufferRef.current);
        
        // Reset the timeout
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }
        barcodeTimeoutRef.current = setTimeout(() => {
          console.log('[Scanner] Timeout cleared buffer:', barcodeBufferRef.current);
          barcodeBufferRef.current = '';
        }, 200); // Increased timeout slightly
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [handleBarcodeScan]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.shopId || !quickAddName || !quickAddPrice) return;

    setIsQuickAdding(true);
    try {
      const newProduct = {
        name: quickAddName,
        barcode: quickAddBarcode,
        sellingPrice: Number(quickAddPrice),
        stock: 1, // Start with 1 stock so it doesn't immediately go negative
        purchasePrice: 0,
        gst: 0,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'shops', shopData.shopId, 'products'), newProduct);
      
      // Immediately add to cart
      addToCart({ id: docRef.id, ...newProduct } as Product);
      
      // Close modal
      setQuickAddBarcode('');
    } catch (error) {
      console.error('Error quick adding product:', error);
      alert('Failed to add product');
    } finally {
      setIsQuickAdding(false);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + ((item.sellingPrice || 0) * item.qty), 0);
  const tax = cart.reduce((sum, item) => sum + (((item.sellingPrice || 0) * item.qty) * ((item.gst || 0) / 100)), 0);
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (!shopData?.shopId || cart.length === 0) return;
    
    setCheckoutLoading(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Create Sale Document
      const saleRef = doc(collection(db, 'shops', shopData.shopId, 'sales'));
      batch.set(saleRef, {
        totalAmount: total,
        subtotal: subtotal,
        taxAmount: tax,
        items: cart,
        paymentMethod: 'cash',
        createdAt: new Date().toISOString()
      });

      // 2. Decrement Stock for each item
      cart.forEach(item => {
        const productRef = doc(db, 'shops', shopData.shopId, 'products', item.id);
        const newStock = Math.max(0, (item.stock || 0) - item.qty);
        batch.update(productRef, { stock: newStock });
      });

      await batch.commit();
      
      // Save result for the success modal
      setCheckoutResult({
        id: saleRef.id,
        total,
        items: [...cart]
      });

      // Clear cart on success
      setCart([]);
      setSearchTerm('');
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Checkout failed. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode?.includes(searchTerm) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleWhatsAppBill = () => {
    if (!checkoutResult || !shopData) return;
    
    let text = `*${shopData.shopName}*\n`;
    text += `Invoice: #${checkoutResult.id.slice(-6).toUpperCase()}\n\n`;
    text += `*Items:*\n`;
    checkoutResult.items.forEach(item => {
      text += `${item.name} x${item.qty} - ₹${((item.sellingPrice || 0) * item.qty).toFixed(2)}\n`;
    });
    text += `\n*Total Amount: ₹${checkoutResult.total.toFixed(2)}*\n\n`;
    text += `Thank you for shopping with us!`;

    const encodedText = encodeURIComponent(text);
    // Open WhatsApp (works on web and mobile)
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const handleVoiceSearch = () => {
    if (!voiceSupported) {
      alert("Voice search is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // Indian English, catches Hindi words better often
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const speechResult = event.results[0][0].transcript;
      setSearchTerm(speechResult);
      // Auto-focus the input after listening
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="flex flex-col md:flex-row h-full gap-6 relative">
      {/* Checkout Success Modal with UPI */}
      {checkoutResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground p-0 rounded-2xl border shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-green-500 p-6 text-white text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-2 opacity-90" />
              <h2 className="text-2xl font-bold">Checkout Complete</h2>
              <p className="opacity-90">Bill Total: ₹{checkoutResult.total.toFixed(2)}</p>
            </div>

            <div className="p-6 space-y-6">
              {shopData?.upiId ? (
                <div className="flex flex-col items-center justify-center space-y-3 bg-muted/30 p-4 rounded-xl border border-muted">
                  <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm">
                    <QrCode className="h-4 w-4" /> Scan to Pay with Any App
                  </div>
                  <div className="bg-white p-3 rounded-xl shadow-sm border">
                    <QRCodeSVG 
                      value={`upi://pay?pa=${shopData.upiId}&pn=${encodeURIComponent(shopData.shopName || shopData.name || 'Store')}&am=${checkoutResult.total.toFixed(2)}&cu=INR`} 
                      size={180} 
                      level="H"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">UPI: {shopData.upiId}</p>
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground bg-orange-50 dark:bg-orange-950 p-3 rounded-lg border border-orange-200 dark:border-orange-900">
                  Add your UPI ID in Settings to generate payment QR codes automatically!
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12 w-full flex gap-2 font-medium" onClick={handleWhatsAppBill}>
                  <MessageCircle className="h-4 w-4 text-green-500" /> WhatsApp
                </Button>
                <Button className="h-12 w-full font-bold" onClick={() => setCheckoutResult(null)}>
                  New Bill
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Quick Add Modal */}
      {quickAddBarcode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card/95 backdrop-blur-xl text-card-foreground p-0 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-primary to-purple-600 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <ShoppingCart className="h-24 w-24 -mr-8 -mt-8" />
              </div>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">New Product Scanned!</h2>
                  <p className="text-white/80 text-sm mt-1">Let's add this to your inventory.</p>
                </div>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setQuickAddBarcode('')}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Search className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Scanned Barcode</span>
                </div>
                <span className="font-mono font-bold text-lg">{quickAddBarcode}</span>
              </div>

              <form onSubmit={handleQuickAdd} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80">Product Name</label>
                  <Input 
                    required
                    autoFocus
                    value={quickAddName}
                    onChange={e => setQuickAddName(e.target.value)}
                    placeholder="e.g. Parle-G 10rs" 
                    className="h-12 text-lg font-medium bg-background border-muted focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80">Selling Price (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={quickAddPrice}
                      onChange={e => setQuickAddPrice(e.target.value)}
                      placeholder="0.00" 
                      className="pl-10 h-12 text-lg font-bold bg-background border-muted focus:ring-primary/50"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                  <Button type="button" variant="outline" className="h-11 px-6 rounded-xl font-medium" onClick={() => setQuickAddBarcode('')}>Cancel</Button>
                  <Button type="submit" disabled={isQuickAdding} className="h-11 px-6 rounded-xl font-bold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 shadow-lg shadow-primary/25 transition-all">
                    {isQuickAdding ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Plus className="h-5 w-5 mr-2" />}
                    Add & Bill
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Products & Search Section */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            ref={searchInputRef}
            placeholder="Search products, scan barcode, or use voice..." 
            className="pl-10 pr-12 h-14 text-lg shadow-sm rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full shadow-sm hover:border-primary/50 text-primary bg-primary/5 h-10 w-10"
              onClick={() => setShowScanner(true)}
            >
              <Camera className="h-5 w-5" />
            </Button>
            {voiceSupported && (
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full transition-all h-10 w-10 ${
                  isListening 
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse' 
                    : 'text-muted-foreground hover:text-primary hover:bg-muted'
                }`}
                onClick={handleVoiceSearch}
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pb-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.map(product => (
            <div 
              key={product.id} 
              className="border rounded-xl p-4 cursor-pointer hover:border-primary hover:shadow-md transition-all bg-card text-card-foreground"
              onClick={() => addToCart(product)}
            >
              <div className="h-24 bg-muted/50 rounded-lg mb-3 flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest font-bold">
                {product.category || 'Product'}
              </div>
              <h3 className="font-medium text-sm line-clamp-2 leading-tight">{product.name}</h3>
              <div className="flex items-center justify-between mt-2">
                <p className="font-bold text-primary">₹{product.sellingPrice}</p>
                <p className="text-xs text-muted-foreground">Stk: {product.stock}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-full md:w-[400px] flex flex-col bg-white dark:bg-gray-800 rounded-xl border shadow-sm h-full">
        <div className="p-4 border-b bg-gray-50/50 dark:bg-gray-900/50 rounded-t-xl flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Current Bill
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setCart([])} disabled={cart.length === 0}>
            Clear
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <ShoppingCart className="h-12 w-12 opacity-20" />
              <p>Cart is empty</p>
              <p className="text-xs">Scan a barcode to add products</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center justify-between border-b pb-3">
                <div className="flex-1">
                  <p className="font-medium text-sm leading-tight">{item.name}</p>
                  <p className="text-muted-foreground text-xs mt-1">₹{item.sellingPrice} x {item.qty}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="font-bold">₹{((item.sellingPrice || 0) * item.qty).toFixed(2)}</p>
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(item.id)}>
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 dark:bg-gray-800 rounded-b-xl space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-medium">₹{tax.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">₹{total.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" className="h-12 flex flex-col gap-1 text-xs">
              <Users className="h-4 w-4" /> Add Customer
            </Button>
            <Button variant="outline" className="h-12 flex flex-col gap-1 text-xs">
              <FileText className="h-4 w-4" /> Save Draft
            </Button>
            <Button 
              className="col-span-2 h-14 text-lg font-bold" 
              disabled={cart.length === 0 || checkoutLoading}
              onClick={handleCheckout}
            >
              {checkoutLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <IndianRupee className="mr-2 h-5 w-5" />
              )}
              Pay ₹{total.toFixed(2)}
            </Button>
          </div>
        </div>
      </div>

      {showScanner && (
        <CameraScanner 
          onScan={(code) => {
            handleBarcodeScan(code);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
