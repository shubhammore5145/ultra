import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Search, Plus, Minus, Trash, Users, IndianRupee, FileText, ShoppingCart, Loader2, X, CheckCircle2, MessageCircle, QrCode, Mic, Camera, Printer } from 'lucide-react';
import { collection, query, onSnapshot, writeBatch, doc, addDoc, where, getDocs } from 'firebase/firestore';
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
  const [customerPhone, setCustomerPhone] = useState('');
  const [showMobileCart, setShowMobileCart] = useState(false);

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
  const [checkoutResult, setCheckoutResult] = useState<{ id: string, total: number, items: CartItem[], customerPhone: string } | null>(null);

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
      
      let finalCustomerId = null;

      // 1. Check or Create Customer if phone is provided
      if (customerPhone.trim()) {
        const phone = customerPhone.trim();
        const customersRef = collection(db, 'shops', shopData.shopId, 'customers');
        const q = query(customersRef, where('phone', '==', phone));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Customer exists, increment visits and totalSpent
          const customerDoc = querySnapshot.docs[0];
          finalCustomerId = customerDoc.id;
          const customerData = customerDoc.data();
          const currentVisits = customerData.visits || 0;
          const currentTotal = customerData.totalSpent || 0;
          
          batch.update(customerDoc.ref, {
            visits: currentVisits + 1,
            totalSpent: currentTotal + total
          });
        } else {
          // Create new customer
          const newCustomerRef = doc(customersRef);
          finalCustomerId = newCustomerRef.id;
          batch.set(newCustomerRef, {
            name: 'New Customer',
            phone: phone,
            address: '',
            balance: 0,
            visits: 1,
            totalSpent: total,
            createdAt: new Date().toISOString()
          });
        }
      }

      // 2. Create Sale Document
      const saleRef = doc(collection(db, 'shops', shopData.shopId, 'sales'));
      batch.set(saleRef, {
        totalAmount: total,
        subtotal: subtotal,
        taxAmount: tax,
        items: cart,
        paymentMethod: 'cash',
        customerPhone: customerPhone.trim() || null,
        customerId: finalCustomerId,
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
        items: [...cart],
        customerPhone: customerPhone.trim()
      });

      // Clear cart on success
      setCart([]);
      setSearchTerm('');
      setCustomerPhone('');
      setShowMobileCart(false);
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
    
    let text = `*${shopData.name || 'Kirana Store'}*\n`;
    text += `Invoice: #${checkoutResult.id.slice(-6).toUpperCase()}\n\n`;
    text += `*Items:*\n`;
    checkoutResult.items.forEach(item => {
      text += `${item.name} x${item.qty} - ₹${((item.sellingPrice || 0) * item.qty).toFixed(2)}\n`;
    });
    text += `\n*Total Amount: ₹${checkoutResult.total.toFixed(2)}*\n\n`;
    text += `Thank you for shopping with us!`;

    const encodedText = encodeURIComponent(text);
    
    // If we have a customer phone, send directly to them. Otherwise, let user pick contact.
    const phone = checkoutResult.customerPhone;
    const url = phone ? `https://wa.me/91${phone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
    
    window.open(url, '_blank');
  };

  const handlePrintReceipt = () => {
    window.print();
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

              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-12 w-full flex gap-1 font-medium px-2" onClick={handleWhatsAppBill}>
                  <MessageCircle className="h-4 w-4 text-green-500" /> WhatsApp
                </Button>
                <Button variant="outline" className="h-12 w-full flex gap-1 font-medium px-2" onClick={handlePrintReceipt}>
                  <Printer className="h-4 w-4 text-blue-500" /> Print
                </Button>
                <Button className="h-12 w-full font-bold px-2" onClick={() => setCheckoutResult(null)}>
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
      <div className="flex-1 flex flex-col gap-4 pb-20 md:pb-0">
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

      {/* Mobile Floating Cart Summary */}
      <div className="md:hidden fixed bottom-[60px] left-0 right-0 p-3 bg-card border-t border-border shadow-[0_-4px_15px_rgba(0,0,0,0.1)] z-30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cart.length} Items</p>
            <p className="text-xl font-extrabold text-foreground">₹{total.toFixed(2)}</p>
          </div>
          <Button 
            className="flex-1 h-12 text-base font-bold shadow-md"
            onClick={() => setShowMobileCart(true)}
          >
            <ShoppingCart className="mr-2 h-5 w-5" /> View Cart
          </Button>
        </div>
      </div>

      {/* Cart Section (Sidebar on Desktop, Full Overlay on Mobile) */}
      <div className={`
        fixed inset-0 z-[100] bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 flex flex-col
        md:static md:w-[400px] md:bg-card md:text-card-foreground md:rounded-xl md:border md:shadow-sm md:h-full md:z-auto
        transition-transform duration-300 ease-in-out
        ${showMobileCart ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
      `}>
        {/* Mobile Header for Cart Overlay */}
        <div className="md:hidden p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between shadow-sm">
          <h2 className="font-bold text-xl flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Checkout
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setShowMobileCart(false)} className="rounded-full bg-muted/50">
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex p-4 border-b bg-muted/30 rounded-t-xl items-center justify-between">
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
              <Button variant="outline" className="mt-4 md:hidden" onClick={() => setShowMobileCart(false)}>
                Go Back to Products
              </Button>
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

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 md:bg-muted/10 md:rounded-b-xl space-y-3 shrink-0 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:shadow-none">
          <div className="flex flex-col gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <label className="text-xs font-medium text-muted-foreground">Customer Mobile No. (For WhatsApp Bill)</label>
            <Input 
              placeholder="e.g. 9876543210" 
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="h-12 md:h-10 text-base md:text-sm bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-950 dark:text-zinc-50"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-lg font-bold pt-1 border-t">
            <span>Total</span>
            <span className="text-primary">₹{total.toFixed(2)}</span>
          </div>

          <div className="pt-2">
            <Button 
              className="w-full h-14 text-lg font-bold shadow-md bg-gradient-to-r from-primary to-purple-600 hover:opacity-90" 
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

      {/* Hidden Receipt Template for Thermal Printing */}
      {checkoutResult && shopData && (
        <div id="receipt-template" className="hidden">
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{shopData.shopName || shopData.name}</h2>
            {shopData.address && <p style={{ margin: 0 }}>{shopData.address}</p>}
            {shopData.phone && <p style={{ margin: 0 }}>Ph: {shopData.phone}</p>}
            {shopData.gstNumber && <p style={{ margin: 0 }}>GST: {shopData.gstNumber}</p>}
          </div>
          <div style={{ borderBottom: '1px dashed #000', marginBottom: '5px' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>Date: {new Date().toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>Inv: #{checkoutResult.id.slice(-6).toUpperCase()}</span>
          </div>
          <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', paddingBottom: '5px' }}>Item</th>
                <th style={{ textAlign: 'center', paddingBottom: '5px' }}>Qty</th>
                <th style={{ textAlign: 'right', paddingBottom: '5px' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {checkoutResult.items.map(item => (
                <tr key={item.id}>
                  <td style={{ padding: '2px 0' }}>{item.name}</td>
                  <td style={{ textAlign: 'center' }}>{item.qty}</td>
                  <td style={{ textAlign: 'right' }}>{((item.sellingPrice || 0) * item.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ borderBottom: '1px dashed #000', marginBottom: '5px' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginBottom: '10px' }}>
            <span>TOTAL</span>
            <span>₹{checkoutResult.total.toFixed(2)}</span>
          </div>
          <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>
          
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <p style={{ margin: 0 }}>Thank you for shopping!</p>
            <p style={{ margin: 0 }}>Visit Again</p>
          </div>
        </div>
      )}
    </div>
  );
}
