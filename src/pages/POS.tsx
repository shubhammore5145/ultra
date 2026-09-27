import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Search, Plus, Minus, Trash, Users, IndianRupee, FileText, ShoppingCart, Loader2, X, CheckCircle2, MessageCircle, QrCode, Mic, Camera, Printer, Barcode, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CameraScanner } from '../components/CameraScanner';
import Tesseract from 'tesseract.js';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product, CartItem } from '../types';

const cleanPhone = (val: string) => {
  let digits = String(val || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(-10);
};

export default function POS() {
  const { shopData } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState('');
  const [whatsappStatusBanner, setWhatsappStatusBanner] = useState<{
    type: 'loading' | 'success' | 'error';
    message: string;
  } | null>(null);
  const [floatingNotification, setFloatingNotification] = useState('');
  const [liveWaStatus, setLiveWaStatus] = useState<string>('DISCONNECTED');

  // Poll WhatsApp Bot status for live indicator
  useEffect(() => {
    const checkWa = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        setLiveWaStatus(data.status || 'DISCONNECTED');
      } catch {
        setLiveWaStatus('DISCONNECTED');
      }
    };
    checkWa();
    const interval = setInterval(checkWa, 7000);
    return () => clearInterval(interval);
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Voice Search State
  const [isListening, setIsListening] = useState(false);
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const voiceSupported = !!SpeechRecognition;

  // Quick Add State
  const [quickAddBarcode, setQuickAddBarcode] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPrice, setQuickAddPrice] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'barcoded' | 'loose'>('all');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  // Parchi Scanner State
  const [showParchiModal, setShowParchiModal] = useState(false);
  const [isParchiScanning, setIsParchiScanning] = useState(false);
  const [parchiText, setParchiText] = useState('');

  // Checkout Success State
  const [checkoutResult, setCheckoutResult] = useState<{ 
    id: string, 
    subtotal: number,
    discountAmount: number,
    total: number, 
    items: CartItem[], 
    customerPhone: string,
    loyaltyPointsEarned?: number
  } | null>(null);

  // Camera Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const [showScannerMenu, setShowScannerMenu] = useState(false);
  const [showPhysicalScannerReady, setShowPhysicalScannerReady] = useState(false);

  // Split Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({ cash: 0, upi: 0, udhar: 0 });
  const [customerAadhar, setCustomerAadhar] = useState('');
  const [customerPhoto, setCustomerPhoto] = useState('');

  // Fetch live products for fast POS search
  useEffect(() => {
    if (!shopData?.shopId) return;

    const fetchProducts = async () => {
      try {
        const prods = await api.products.list();
        setProducts(prods);
      } catch (err) {
        console.error('Failed to load products', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProducts();
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
      setShowPhysicalScannerReady(false);
    } else {
      // Open Quick Add Modal
      setQuickAddBarcode(barcode);
      setQuickAddName('');
      setQuickAddPrice('');
      setShowPhysicalScannerReady(false);
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
        id: crypto.randomUUID(),
        name: quickAddName,
        barcode: quickAddBarcode,
        sellingPrice: Number(quickAddPrice),
        stock: 1, // Start with 1 stock so it doesn't immediately go negative
        purchasePrice: 0,
        gst: 0,
        createdAt: new Date().toISOString()
      };

      await api.products.create(newProduct);
      
      // Immediately add to cart
      addToCart(newProduct as unknown as Product);
      
      // Close modal
      setQuickAddBarcode('');
    } catch (error) {
      console.error('Error quick adding product:', error);
      alert('Failed to add product');
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleParchiScan = async (file: File) => {
    setIsParchiScanning(true);
    setParchiText('AI reading handwriting from image...');
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      setParchiText(text);

      const lines = text.toLowerCase().split(/[\n,;]+/).map(l => l.trim()).filter(l => l.length > 1);
      const matchedProducts: Product[] = [];

      for (const line of lines) {
        // Strip non-alphanumeric except space
        const cleanLine = line.replace(/[^a-z0-9\s]/g, '').trim();
        if (!cleanLine) continue;

        const wordsInLine = cleanLine.split(/\s+/).filter(w => w.length > 2);
        
        // Find best match among products
        const matched = products.find(p => {
          const pName = (p.name || '').toLowerCase();
          if (pName.includes(cleanLine) || cleanLine.includes(pName)) return true;
          return wordsInLine.some(w => pName.includes(w));
        });

        if (matched && !matchedProducts.some(mp => mp.id === matched.id)) {
          matchedProducts.push(matched);
        }
      }

      if (matchedProducts.length > 0) {
        matchedProducts.forEach(p => addToCart(p));
        alert(`🎉 AI Parchi Match: Added ${matchedProducts.length} items to cart:\n${matchedProducts.map(m => `• ${m.name}`).join('\n')}`);
        setShowParchiModal(false);
      } else {
        alert(`Extracted text:\n"${text.trim() || 'No clear text detected'}"\n\nNo matching products found in inventory. You can search or add products manually.`);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      alert('Failed to process image. Please try again with clear handwriting.');
    } finally {
      setIsParchiScanning(false);
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
  
  let discountAmount = 0;
  const numDiscount = Number(discountValue) || 0;
  if (discountType === 'flat') {
    discountAmount = numDiscount;
  } else {
    discountAmount = (subtotal * numDiscount) / 100;
  }
  
  const total = Math.max(0, subtotal + tax - discountAmount);

  const handleCheckout = async (paymentMethod: 'cash' | 'upi' | 'udhar' | 'split' = 'cash', splitAmounts?: { cash: number, upi: number, udhar: number }) => {
    if (!shopData?.shopId || cart.length === 0) return;
    
    setCheckoutLoading(true);
    try {
      let finalCustomerId = null;

      // 1. Check or Create Customer if phone is provided
      if (customerPhone.trim()) {
        const phone = customerPhone.trim();
        const customers = await api.customers.list();
        const existing = customers.find((c: any) => c.phone === phone);

        if (existing) {
          finalCustomerId = existing.id;
          if (customerAadhar || customerPhoto) {
            await api.customers.update(existing.id, {
              ...existing,
              aadharNumber: customerAadhar || existing.aadharNumber,
              photoUrl: customerPhoto || existing.photoUrl
            });
          }
        } else {
          finalCustomerId = crypto.randomUUID();
          await api.customers.create({
            id: finalCustomerId,
            name: 'New Customer',
            phone: phone,
            aadharNumber: customerAadhar,
            photoUrl: customerPhoto,
            address: '',
            balance: 0,
            createdAt: new Date().toISOString()
          });
        }
      }

      const txId = crypto.randomUUID();

      // 2. Create Sale
      await api.transactions.create({
        id: txId,
        subtotal: subtotal,
        discountAmount: discountAmount,
        totalAmount: total,
        taxAmount: tax,
        items: cart,
        paymentMethod: paymentMethod,
        splitAmounts: splitAmounts,
        customerId: finalCustomerId,
        createdAt: new Date().toISOString()
      });
      
      const phoneToSend = cleanPhone(customerPhone);

      // Save result for the success modal
      setCheckoutResult({
        id: txId,
        subtotal,
        discountAmount,
        total,
        items: [...cart],
        customerPhone: phoneToSend,
        loyaltyPointsEarned: Math.floor(total / 100)
      });
      setPaymentVerified(false);

      // Auto-send WhatsApp bill if customer phone is provided (10 digits)
      if (phoneToSend.length === 10) {
        sendWhatsAppBill(txId, total, phoneToSend, [...cart], discountAmount, paymentMethod);
      } else {
        setWhatsappStatusBanner(null);
      }

      // Clear cart on success
      setCart([]);
      setSearchTerm('');
      setCustomerPhone('');
      setCustomerAadhar('');
      setCustomerPhoto('');
      setDiscountValue('');
      setShowMobileCart(false);
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Checkout failed. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.barcode || '').includes(searchTerm) ||
                          (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (activeTab === 'barcoded') return !!p.barcode && p.barcode.trim() !== '';
    if (activeTab === 'loose') return !p.barcode || p.barcode.trim() === '';
    return true;
  });

  const sendWhatsAppBill = async (
    txId: string, 
    billTotal: number, 
    phone: string, 
    itemsList: CartItem[] = checkoutResult?.items || [], 
    discount: number = checkoutResult?.discountAmount || 0,
    paymentMode: string = 'Paid'
  ) => {
    if (!shopData || !phone) return;

    setWhatsappStatusBanner({
      type: 'loading',
      message: `WhatsApp वर बिल पाठवत आहे... (+91 ${phone})`
    });

    const shopName = shopData.shopName || shopData.name || 'Kirana Store';
    const shopPhone = shopData.phone ? `📞 ${shopData.phone}` : '';
    const shopAddr = shopData.address ? `📍 ${shopData.address}` : '';
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Determine public URL for digital receipt link
    const customPublicUrl = (shopData as any)?.publicUrl?.trim()?.replace(/\/$/, '');
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let receiptLink: string | null = null;
    if (customPublicUrl) {
      receiptLink = `${customPublicUrl}/receipt/${txId}`;
    } else if (!isLocalhost) {
      receiptLink = `${window.location.origin}/receipt/${txId}`;
    }

    // Build comprehensive, professional retail WhatsApp bill
    let text = `🏪 *${shopName.toUpperCase()}*\n`;
    const contactLine = [shopAddr, shopPhone].filter(Boolean).join(' | ');
    if (contactLine) {
      text += `${contactLine}\n`;
    }
    text += `📅 ${formattedDate}, ${formattedTime}\n`;
    text += `🧾 *Bill No:* #${txId.slice(0, 8)}\n`;
    text += `────────────────────\n`;

    // Itemized list
    if (itemsList && itemsList.length > 0) {
      text += `🛒 *ITEMS PURCHASED:*\n`;
      itemsList.forEach((item, index) => {
        const itemTotal = (item.sellingPrice * item.quantity).toFixed(2);
        const unit = item.unit ? ` (${item.unit})` : '';
        text += `${index + 1}. *${item.name}${unit}*\n`;
        text += `   ${item.quantity} x ₹${item.sellingPrice.toFixed(2)} = ₹${itemTotal}\n`;
      });
      text += `────────────────────\n`;
    }

    if (discount > 0) {
      const subtotalVal = billTotal + discount;
      text += `Subtotal: ₹${subtotalVal.toFixed(2)}\n`;
      text += `Discount: -₹${discount.toFixed(2)}\n`;
    }

    text += `💰 *TOTAL AMOUNT: ₹${billTotal.toFixed(2)}*\n`;
    text += `💳 *Payment Mode:* ${paymentMode}\n`;
    text += `────────────────────\n`;

    if (receiptLink) {
      text += `\n📄 *Download Digital Receipt (PDF):*\n${receiptLink}\n\n`;
    }

    text += `🙏 *Thank you for shopping with us!*\nPlease visit again! 😊`;

    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      
      if (data.status === 'CONNECTED' || data.status === 'AUTHENTICATED') {
        const sendRes = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, message: text })
        });
        
        if (sendRes.ok) {
          const successMsg = `WhatsApp बिल यशस्वीरित्या +91 ${phone} वर पाठवले! ✅`;
          setWhatsappStatusBanner({
            type: 'success',
            message: successMsg
          });
          setFloatingNotification(successMsg);
          setTimeout(() => setFloatingNotification(''), 7000);
          return;
        } else {
          const errData = await sendRes.json().catch(() => ({}));
          console.warn('WhatsApp auto-send returned error:', errData);
        }
      }
    } catch (e) {
      console.log('Bot auto-send failed, falling back to manual wa.me link', e);
    }

    // Fallback: If bot is not connected or fails, open manual wa.me link
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/91${phone}?text=${encodedText}`;
    window.open(url, '_blank');
    const fallbackMsg = `WhatsApp मेसेज लिंक उघडली (+91 ${phone}) 📱`;
    setWhatsappStatusBanner({
      type: 'success',
      message: fallbackMsg
    });
    setFloatingNotification(fallbackMsg);
    setTimeout(() => setFloatingNotification(''), 7000);
  };

  const handleWhatsAppBill = () => {
    if (!checkoutResult) return;
    let targetPhone = checkoutResult.customerPhone ? cleanPhone(checkoutResult.customerPhone) : '';
    if (!targetPhone || targetPhone.length !== 10) {
      const input = window.prompt('ग्राहक व्हॉट्सअॅप नंबर टाका (10 अंकी मोबाइल नंबर):');
      if (!input) return;
      targetPhone = cleanPhone(input);
      if (targetPhone.length !== 10) {
        alert('कृपया 10 अंकी वैध मोबाइल नंबर टाका.');
        return;
      }
    }
    sendWhatsAppBill(
      checkoutResult.id, 
      checkoutResult.total, 
      targetPhone,
      checkoutResult.items,
      checkoutResult.discountAmount,
      'Paid'
    );
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
      {/* Floating Notification for WhatsApp Bill */}
      {floatingNotification && (
        <div className="fixed top-5 right-5 z-[9999] max-w-sm w-full bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/40 animate-in slide-in-from-top-4 fade-in duration-300">
          <CheckCircle2 className="h-6 w-6 text-white shrink-0" />
          <div className="flex-1 text-sm font-semibold">
            {floatingNotification}
          </div>
          <button onClick={() => setFloatingNotification('')} className="text-white/80 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Checkout Success Modal with UPI */}
      {checkoutResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200 p-4 no-print">
          <div className="bg-card text-card-foreground p-0 rounded-2xl border shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 print-only" id="receipt-modal">
            <div className="bg-green-500 p-6 text-white text-center no-print">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-2 opacity-90" />
              <h2 className="text-2xl font-bold">Checkout Complete</h2>
              <p className="opacity-90">Bill Total: ₹{checkoutResult.total.toFixed(2)}</p>
              {checkoutResult.discountAmount > 0 && (
                <p className="text-sm opacity-80 mt-1">Includes ₹{checkoutResult.discountAmount.toFixed(2)} savings!</p>
              )}
            </div>

            {/* WhatsApp Status Banner in Modal */}
            {whatsappStatusBanner && (
              <div className={`mx-6 mt-4 p-3 rounded-xl border flex items-center gap-3 text-sm animate-in fade-in duration-300 ${
                whatsappStatusBanner.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200'
              }`}>
                {whatsappStatusBanner.type === 'loading' ? (
                  <Loader2 className="h-5 w-5 animate-spin shrink-0 text-blue-600 dark:text-blue-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                <div className="flex-1 font-semibold text-xs leading-tight">
                  {whatsappStatusBanner.message}
                </div>
              </div>
            )}

            <div className="p-6 space-y-6">
              {shopData?.upiId ? (
                <div className={`flex flex-col items-center justify-center space-y-3 p-4 rounded-xl border transition-all duration-300 ${
                  paymentVerified 
                    ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900' 
                    : 'bg-muted/30 border-muted relative overflow-hidden'
                }`}>
                  {!paymentVerified && (
                    <div className="absolute inset-0 pointer-events-none opacity-20">
                      <div className="w-full h-[2px] bg-primary animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(var(--primary),0.8)]"></div>
                    </div>
                  )}

                  <div className={`flex items-center gap-2 font-medium text-sm transition-colors ${paymentVerified ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                    {paymentVerified ? (
                      <><CheckCircle2 className="h-5 w-5" /> Payment Verified Successfully</>
                    ) : (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Listening for Payment...</>
                    )}
                  </div>
                  
                  <div className={`bg-white p-3 rounded-xl shadow-sm border transition-all duration-500 ${paymentVerified ? 'scale-90 opacity-50 blur-[2px]' : 'scale-100 opacity-100'}`}>
                    <QRCodeSVG 
                      value={`upi://pay?pa=${shopData.upiId}&pn=${encodeURIComponent(shopData.shopName || shopData.name || 'Store')}&am=${checkoutResult.total.toFixed(2)}&cu=INR`} 
                      size={160} 
                      level="H"
                    />
                  </div>
                  
                  {!paymentVerified ? (
                    <Button 
                      variant="default" 
                      className="w-full h-10 font-bold bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 shadow-none"
                      onClick={() => setPaymentVerified(true)}
                    >
                      Verify Manually
                    </Button>
                  ) : (
                    <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">Transaction Complete</p>
                  )}
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground bg-orange-50 dark:bg-orange-950 p-3 rounded-lg border border-orange-200 dark:border-orange-900">
                  Add your UPI ID in Settings to generate payment QR codes automatically!
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 no-print">
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
              title="Scan Parchi (List)"
              className="rounded-full shadow-sm hover:border-blue-500/50 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 h-10 w-10 mr-1"
              onClick={() => setShowParchiModal(true)}
            >
              <FileText className="h-5 w-5" />
            </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full shadow-sm hover:border-primary/50 text-primary bg-primary/5 h-10 w-10"
                onClick={() => setShowScanner(true)}
              >
              <Barcode className="h-5 w-5" />
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

        {/* Category Tabs & WhatsApp Bot Live Indicator */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-hide -mt-2">
          <div className="flex gap-2">
            <Button 
              variant={activeTab === 'all' ? 'default' : 'outline'} 
              className="rounded-full px-5 whitespace-nowrap text-xs md:text-sm"
              onClick={() => setActiveTab('all')}
            >
              All Items
            </Button>
            <Button 
              variant={activeTab === 'loose' ? 'default' : 'outline'} 
              className="rounded-full px-5 whitespace-nowrap text-xs md:text-sm"
              onClick={() => setActiveTab('loose')}
            >
              Loose Items
            </Button>
            <Button 
              variant={activeTab === 'barcoded' ? 'default' : 'outline'} 
              className="rounded-full px-5 whitespace-nowrap text-xs md:text-sm"
              onClick={() => setActiveTab('barcoded')}
            >
              Barcoded
            </Button>
          </div>

          <div className="shrink-0">
            {liveWaStatus === 'CONNECTED' || liveWaStatus === 'AUTHENTICATED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-950/80 dark:text-green-300 border border-green-300 dark:border-green-800 shadow-xs" title="Auto WhatsApp Bot सक्रिय आहे. चेकआउटवर आपोआप बिल पाठवले जाईल.">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <Smartphone className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> WhatsApp Bot Active
              </span>
            ) : (
              <Link to="/settings" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 transition-colors shadow-xs" title="WhatsApp Bot सुरू करण्यासाठी किंवा QR स्कॅन करण्यासाठी क्लिक करा">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <Smartphone className="w-3.5 h-3.5 text-amber-600" /> Bot Offline (Connect)
              </Link>
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
              <div className="h-24 bg-white rounded-lg mb-3 flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest font-bold overflow-hidden border">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-1" />
                ) : (
                  <div className="h-full w-full bg-muted/50 flex items-center justify-center">
                    {product.category || 'Product'}
                  </div>
                )}
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

      {/* Parchi Scanner Modal */}
      {showParchiModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="bg-card text-card-foreground p-0 rounded-2xl border shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5" /> AI Parchi Scanner
                  </h2>
                  <p className="text-white/80 text-xs mt-1">Upload a photo of handwritten list to auto-add items.</p>
                </div>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setShowParchiModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 flex flex-col items-center justify-center bg-muted/10">
                {isParchiScanning ? (
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <FileText className="h-16 w-16 text-blue-500 opacity-50" />
                      <div className="absolute inset-0 bg-blue-500/20 animate-pulse rounded-lg"></div>
                      {/* Scanning laser line effect */}
                      <div className="absolute left-0 right-0 h-1 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-[scan_1.5s_ease-in-out_infinite]"></div>
                    </div>
                    <p className="mt-4 font-bold text-blue-600 animate-pulse">Reading handwriting...</p>
                    <p className="text-xs text-muted-foreground mt-1">Matching items with inventory</p>
                  </div>
                ) : (
                  <>
                    <Camera className="h-12 w-12 text-muted-foreground mb-3" />
                    <div className="flex flex-col gap-2 w-full max-w-[240px]">
                      <label className="cursor-pointer">
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleParchiScan(file);
                          }}
                        />
                        <span className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
                          <Camera className="h-4 w-4" /> Camera Capture
                        </span>
                      </label>
                      <label className="cursor-pointer">
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleParchiScan(file);
                          }}
                        />
                        <span className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors">
                          📁 Upload Parchi Photo
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">Make sure the handwriting is clear and well-lit.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex flex-col gap-1.5 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Customer Mobile No. (For WhatsApp Bill)</label>
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${customerPhone.length === 10 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 font-bold' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                {customerPhone.length}/10
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400 select-none">
                +91
              </span>
              <Input 
                placeholder="10-digit mobile number" 
                type="tel"
                maxLength={10}
                value={customerPhone}
                onChange={(e) => {
                  const val = cleanPhone(e.target.value);
                  setCustomerPhone(val);
                }}
                className="h-12 md:h-10 pl-12 text-base md:text-sm bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-950 dark:text-zinc-50 font-mono tracking-wider"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <label className="text-xs font-medium text-muted-foreground">Discount</label>
            <div className="flex gap-2">
              <Button 
                variant={discountType === 'flat' ? 'default' : 'outline'}
                onClick={() => setDiscountType('flat')}
                className="w-12 h-10 px-0"
              >
                ₹
              </Button>
              <Button 
                variant={discountType === 'percent' ? 'default' : 'outline'}
                onClick={() => setDiscountType('percent')}
                className="w-12 h-10 px-0"
              >
                %
              </Button>
              <Input 
                placeholder="0" 
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="h-10 flex-1 text-base bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-950 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">₹{subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400 font-medium">
              <span>Discount</span>
              <span>-₹{discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-lg font-bold pt-1 border-t">
            <span>Total</span>
            <span className="text-primary">₹{total.toFixed(2)}</span>
          </div>

          <div className="pt-2">
            <Button 
              className="w-full h-14 text-lg font-bold shadow-md bg-gradient-to-r from-primary to-purple-600 hover:opacity-90" 
              disabled={cart.length === 0 || checkoutLoading}
              onClick={() => {
                setSplitAmounts({ cash: total, upi: 0, udhar: 0 });
                setShowPaymentModal(true);
              }}
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

      {showPaymentModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground p-6 rounded-2xl border shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Select Payment</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowPaymentModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
                <span className="font-semibold text-blue-700 dark:text-blue-400">Total Bill:</span>
                <span className="font-bold text-2xl text-blue-700 dark:text-blue-400">₹{total.toFixed(2)}</span>
              </div>
              
              <div className="flex flex-col gap-1 bg-muted/40 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Customer Mobile (WhatsApp Bill):</Label>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${customerPhone.length === 10 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 font-bold' : 'text-muted-foreground'}`}>
                    {customerPhone.length}/10
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 select-none">
                    +91
                  </span>
                  <Input 
                    type="tel" 
                    placeholder="10-digit number"
                    maxLength={10}
                    value={customerPhone} 
                    onChange={(e) => {
                      const val = cleanPhone(e.target.value);
                      setCustomerPhone(val);
                    }}
                    className="h-9 pl-9 font-mono text-sm bg-background border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <Label className="w-20 text-zinc-900 dark:text-zinc-100 font-medium">Cash:</Label>
                  <Input 
                    type="number" 
                    value={splitAmounts.cash || ''} 
                    onChange={(e) => setSplitAmounts(p => ({ ...p, cash: Number(e.target.value) || 0 }))}
                    className="flex-1 font-bold text-lg bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-20 text-zinc-900 dark:text-zinc-100 font-medium">UPI:</Label>
                  <Input 
                    type="number" 
                    value={splitAmounts.upi || ''} 
                    onChange={(e) => setSplitAmounts(p => ({ ...p, upi: Number(e.target.value) || 0 }))}
                    className="flex-1 font-bold text-lg bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-20 text-zinc-900 dark:text-zinc-100 font-medium">Udhar:</Label>
                  <Input 
                    type="number" 
                    value={splitAmounts.udhar || ''} 
                    onChange={(e) => setSplitAmounts(p => ({ ...p, udhar: Number(e.target.value) || 0 }))}
                    className="flex-1 font-bold text-lg bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                
                {splitAmounts.udhar > 0 && (
                  <div className="pt-2 border-t border-dashed mt-2 space-y-3">
                    <p className="text-xs text-muted-foreground font-semibold">Udhar Customer Details</p>
                    <div className="flex items-center gap-3">
                      <Label className="w-20 text-xs">Aadhar:</Label>
                      <Input 
                        placeholder="Aadhar Number" 
                        value={customerAadhar} 
                        onChange={(e) => setCustomerAadhar(e.target.value)}
                        className="flex-1 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="w-20 text-xs">Photo:</Label>
                      <div className="flex-1 flex items-center gap-2">
                        {customerPhoto ? (
                          <div className="relative h-10 w-10 rounded border overflow-hidden">
                            <img src={customerPhoto} alt="Customer" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer" onClick={() => setCustomerPhoto('')}>
                              <X className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="relative h-10 flex-1 border rounded bg-muted/50 flex items-center justify-center text-xs text-muted-foreground cursor-pointer overflow-hidden">
                            <Camera className="h-4 w-4 mr-1" /> Take Photo
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setCustomerPhoto(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {splitAmounts.udhar > 0 && !customerPhone && (
                  <p className="text-xs text-red-500 font-semibold text-center">Customer Phone is required for Udhar!</p>
                )}
                
                {(splitAmounts.cash + splitAmounts.upi + splitAmounts.udhar) !== total && (
                  <p className="text-xs text-orange-500 font-semibold text-center">
                    Warning: Split amounts (₹{splitAmounts.cash + splitAmounts.upi + splitAmounts.udhar}) don't match Total (₹{total})!
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                className="w-full h-12 font-bold px-1 text-sm border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  setShowPaymentModal(false);
                  handleCheckout('cash');
                }}
                disabled={checkoutLoading}
              >
                Full Cash
              </Button>
              <Button 
                className="w-full h-12 font-bold bg-green-600 hover:bg-green-700 text-white px-1 text-sm shadow-sm"
                onClick={() => {
                  setShowPaymentModal(false);
                  handleCheckout('upi');
                }}
                disabled={checkoutLoading}
              >
                Full UPI
              </Button>
              <Button 
                className="w-full h-12 font-bold bg-orange-500 hover:bg-orange-600 text-white px-1 text-sm shadow-sm"
                onClick={() => {
                  if (!customerPhone) {
                    alert("Customer phone is required for Udhar!");
                    return;
                  }
                  setShowPaymentModal(false);
                  handleCheckout('udhar');
                }}
                disabled={checkoutLoading || !customerPhone}
              >
                Full Udhar
              </Button>
              <Button 
                className="col-span-3 w-full h-14 mt-2 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white shadow-lg border-0"
                onClick={() => {
                  setShowPaymentModal(false);
                  
                  // Determine primary payment method for analytics
                  let mainMethod: 'cash' | 'upi' | 'udhar' | 'split' = 'split';
                  if (splitAmounts.cash === total) mainMethod = 'cash';
                  else if (splitAmounts.upi === total) mainMethod = 'upi';
                  else if (splitAmounts.udhar === total) mainMethod = 'udhar';
                  
                  handleCheckout(mainMethod, splitAmounts);
                }}
                disabled={
                  checkoutLoading || 
                  (splitAmounts.udhar > 0 && !customerPhone) || 
                  ((splitAmounts.cash + splitAmounts.upi + splitAmounts.udhar) !== total)
                }
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {showScannerMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground p-6 rounded-2xl border shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Select Scanner</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowScannerMenu(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full h-16 flex items-center justify-start gap-4 text-lg"
                onClick={() => {
                  setShowScannerMenu(false);
                  setShowPhysicalScannerReady(true);
                  // Focus the search input to catch barcode events reliably
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
              >
                <div className="bg-primary/10 p-2 rounded-lg text-primary">
                  <Barcode className="h-6 w-6" />
                </div>
                Physical Scanner
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-16 flex items-center justify-start gap-4 text-lg"
                onClick={() => {
                  setShowScannerMenu(false);
                  setShowScanner(true);
                }}
              >
                <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
                  <Smartphone className="h-6 w-6" />
                </div>
                Mobile Camera
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPhysicalScannerReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground p-8 rounded-2xl border shadow-2xl w-full max-w-md text-center animate-in zoom-in-95 duration-200 relative overflow-hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-4 right-4"
              onClick={() => setShowPhysicalScannerReady(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            
            <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 relative">
              <Barcode className="h-12 w-12 text-primary" />
              <div className="absolute inset-0 border-4 border-primary rounded-full animate-ping opacity-20"></div>
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>
            
            <h2 className="text-2xl font-bold mb-2">Scanner Ready!</h2>
            <p className="text-muted-foreground mb-6">
              Aim your physical barcode scanner at any product and press the trigger button.
            </p>
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              Tip: Keep this window open while scanning multiple items quickly.
            </p>
          </div>
        </div>
      )}

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
        <div id="receipt-template" className="hidden print:block absolute left-0 top-0 w-[80mm] bg-white text-black text-[12px] leading-[1.2] font-mono z-0">
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
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
            <span>Subtotal</span>
            <span>₹{checkoutResult.subtotal.toFixed(2)}</span>
          </div>
          {checkoutResult.discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
              <span>Discount</span>
              <span>-₹{checkoutResult.discountAmount.toFixed(2)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginBottom: '10px' }}>
            <span>TOTAL</span>
            <span>₹{checkoutResult.total.toFixed(2)}</span>
          </div>
          <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>
          
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            {checkoutResult.loyaltyPointsEarned > 0 && (
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>⭐ You earned {checkoutResult.loyaltyPointsEarned} Loyalty Points!</p>
            )}
            <p style={{ margin: 0 }}>Thank you for shopping!</p>
            <p style={{ margin: 0 }}>Visit Again</p>
          </div>
        </div>
      )}
    </div>
  );
}
