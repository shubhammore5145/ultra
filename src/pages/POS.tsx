import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Search, Plus, Minus, Trash, IndianRupee, FileText, ShoppingCart, Loader2, X, CheckCircle2, MessageCircle, Mic, Camera, Printer, Barcode, Smartphone, Sparkles, Clock, Send } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CameraScanner } from '../components/CameraScanner';
import Tesseract from 'tesseract.js';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import type { Product, CartItem } from '../types';
import { compressImage } from '../lib/imageCompressor';

const playSoundboxAlert = (amount: number, method: string) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const modeText = method === 'cash' ? 'Cash' : method === 'upi' ? 'UPI' : method === 'udhar' ? 'Udhar' : 'Order';
      const msg = new SpeechSynthesisUtterance(`${modeText} payment of ₹${Math.round(amount)} received.`);
      msg.rate = 1.05;
      window.speechSynthesis.speak(msg);
    }
  } catch {}
};

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
  const { canAccess, requireFeature, openUpgradeModal } = usePlan();
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('pos_products_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
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
  const [pendingWhatsApp, setPendingWhatsApp] = useState<{
    txId: string;
    phone: string;
    text: string;
    countdown: number;
  } | null>(null);



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
    taxAmount?: number,
    paymentMethod?: string,
    splitAmounts?: { cash: number, upi: number, udhar: number },
    items: CartItem[], 
    customerPhone: string,
    loyaltyPointsEarned?: number,
    createdAt?: string
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
  const [autoRemainderToUdhar, setAutoRemainderToUdhar] = useState(true);

  const buildWhatsAppBillText = (
    txId: string, 
    billTotal: number, 
    phone: string, 
    itemsList: CartItem[] = checkoutResult?.items || [], 
    discount: number = checkoutResult?.discountAmount || 0,
    paymentMode: string = 'Paid'
  ) => {
    const shopName = shopData?.shopName || shopData?.name || 'Kirana Store';
    const shopPhone = shopData?.phone ? `📞 Ph: ${shopData.phone}` : '';
    const shopAddr = shopData?.address ? `📍 ${shopData.address}` : '';
    const shopGst = (shopData?.gstNumber) ? `🏢 GSTIN: ${shopData.gstNumber}` : '';
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

    const numTotal = Number(billTotal || 0);
    const totalQty = itemsList.reduce((sum, item) => sum + Number(item.qty || 1), 0);

    // Simple, clean WhatsApp bill — just header + link
    let text = `🏪 *${shopName.toUpperCase()}*\n`;
    if (shopAddr) text += `${shopAddr}\n`;
    if (shopPhone) text += `${shopPhone}\n`;
    if (shopGst) text += `${shopGst}\n`;
    text += `────────────────────\n`;
    text += `🧾 *RETAIL BILL*\n`;
    text += `*Inv:* #${txId.slice(0, 8).toUpperCase()}\n`;
    text += `*Date:* ${formattedDate}, ${formattedTime}\n`;
    text += `*Items:* ${itemsList.length} (${totalQty} qty)\n`;
    text += `💰 *Total: ₹${numTotal.toFixed(2)}*\n`;
    text += `────────────────────\n`;

    if (receiptLink) {
      text += `📄 *View Full E-Bill / Download PDF:*\n${receiptLink}\n\n`;
    }

    text += `🙏 *Thank you for shopping with us!*\nPlease visit again! 😊`;
    return text;
  };

  const dispatchWhatsAppBill = async (phone: string, text: string, txId: string, retryCount = 0) => {
    setWhatsappStatusBanner({
      type: 'loading',
      message: retryCount > 0 
        ? `Retrying WhatsApp bill (attempt ${retryCount + 1})...` 
        : `Sending WhatsApp bill to +91 ${phone}...`
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch('/api/whatsapp/send-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: text, billNo: txId.slice(0, 8) }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const successMsg = `WhatsApp bill sent to +91 ${phone}! ✅`;
        setWhatsappStatusBanner({
          type: 'success',
          message: successMsg
        });
        setFloatingNotification(successMsg);
        setTimeout(() => setFloatingNotification(''), 7000);
        setTimeout(() => setWhatsappStatusBanner(null), 6000);
      } else {
        const errMsg = data.error || 'Failed to send WhatsApp bill';
        setWhatsappStatusBanner({
          type: 'error',
          message: `⚠️ ${errMsg}`
        });
      }
    } catch (err: any) {
      setWhatsappStatusBanner({
        type: 'error',
        message: `⚠️ Error sending WhatsApp bill: ${err.message}`
      });
    }
  };

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

  // WhatsApp countdown timer for auto-sending
  useEffect(() => {
    if (!pendingWhatsApp) return;

    if (pendingWhatsApp.countdown <= 0) {
      const { phone, text, txId } = pendingWhatsApp;
      setPendingWhatsApp(null);
      dispatchWhatsAppBill(phone, text, txId);
      return;
    }

    const timer = setTimeout(() => {
      setPendingWhatsApp(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
    }, 1000);

    return () => clearTimeout(timer);
  }, [pendingWhatsApp]);


  // Fetch live products for fast POS search
  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      if (products.length === 0) setLoading(true);
      try {
        const prods = await api.products.list();
        if (Array.isArray(prods) && isMounted) {
          setProducts(prods);
          try {
            localStorage.setItem('pos_products_cache', JSON.stringify(prods));
          } catch (e) {
            console.warn('LocalStorage quota or write error', e);
          }
        }
      } catch (err) {
        console.error('Failed to load products in POS', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchProducts();
    return () => { isMounted = false; };
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

  const handleBarcodeScan = useCallback((code: string) => {
    // If the quick add modal is open, don't trigger another scan
    if (quickAddBarcode) return;

    const trimmed = code.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();

    // Check exact match on shortCode, barcode, or sku
    const product = products.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === lower) ||
      ((p as any).shortCode && String((p as any).shortCode).trim().toLowerCase() === lower) ||
      (p.sku && p.sku.trim().toLowerCase() === lower)
    );

    if (product) {
      addToCart(product);
      setShowPhysicalScannerReady(false);
      setSearchTerm('');
    } else {
      // Open Quick Add Modal
      setQuickAddBarcode(code);
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
      setParchiText('');
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
        const phone = cleanPhone(customerPhone.trim());
        const customers = await api.customers.list({ phone });
        const existing = Array.isArray(customers) ? customers.find((c: any) => cleanPhone(c.phone) === phone) : null;

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
        taxAmount: tax,
        paymentMethod: paymentMethod,
        splitAmounts: splitAmounts,
        items: [...cart],
        customerPhone: phoneToSend,
        loyaltyPointsEarned: Math.floor(total / 100),
        createdAt: new Date().toISOString()
      });
      setPaymentVerified(false);
      if (canAccess('audio_soundbox')) {
        playSoundboxAlert(total, paymentMethod);
      }

      // Auto-send WhatsApp bill after configured delay if plan allows and customer phone is provided (10 digits)
      const billDelay = ((shopData as any)?.settings?.billDelaySeconds ?? 5);
      if (canAccess('whatsapp_bills') && phoneToSend.length === 10) {
        const billMsg = buildWhatsAppBillText(txId, total, phoneToSend, [...cart], discountAmount, paymentMethod);
        setPendingWhatsApp({
          txId,
          phone: phoneToSend,
          text: billMsg,
          countdown: billDelay
        });
        setWhatsappStatusBanner({
          type: 'loading',
          message: `Sending WhatsApp bill to +91 ${phoneToSend} in ${billDelay}s...`
        });
      } else {
        setPendingWhatsApp(null);
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
    } catch (error: any) {
      console.error('Checkout failed:', error);
      alert('Checkout failed: ' + (error?.message || 'Please try again.'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
                          (p.name || '').toLowerCase().includes(term) || 
                          (p.barcode || '').toLowerCase().includes(term) ||
                          (p.sku || '').toLowerCase().includes(term) ||
                          ((p as any).shortCode && String((p as any).shortCode).toLowerCase() === term);
    
    if (!matchesSearch) return false;

    if (activeTab === 'barcoded') return !(p as any).isLoose && !!p.barcode && p.barcode.trim() !== '';
    if (activeTab === 'loose') return (p as any).isLoose || !p.barcode || p.barcode.trim() === '' || !!(p as any).shortCode;
    return true;
  });

  // Loose Items for quick buttons strip (साखर, शेंगदाणे, तांदूळ इ.)
  const looseQuickItems = products.filter(p => 
    Boolean((p as any).isLoose) || 
    Boolean((p as any).shortCode) || 
    (!p.barcode || p.barcode.trim() === '')
  );


  const handleWhatsAppBill = () => {
    if (!requireFeature('whatsapp_bills')) return;
    if (!checkoutResult) return;
    let targetPhone = checkoutResult.customerPhone ? cleanPhone(checkoutResult.customerPhone) : '';
    if (!targetPhone || targetPhone.length !== 10) {
      const input = window.prompt('Enter customer 10-digit WhatsApp number:');
      if (!input) return;
      targetPhone = cleanPhone(input);
      if (targetPhone.length !== 10) {
        alert('Please enter a valid 10-digit mobile number.');
        return;
      }
    }
    const text = buildWhatsAppBillText(
      checkoutResult.id, 
      checkoutResult.total, 
      targetPhone, 
      checkoutResult.items, 
      checkoutResult.discountAmount, 
      'Paid'
    );
    dispatchWhatsAppBill(targetPhone, text, checkoutResult.id);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleVoiceSearch = () => {
    if (!requireFeature('voice_billing')) return;
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

      {/* Checkout Success Modal with UPI & Bill Breakdown */}
      {checkoutResult && (() => {
        const modalItems = checkoutResult.items || [];
        const modalTotalMrp = modalItems.reduce((sum, it) => {
          const sp = Number(it.sellingPrice || 0);
          const mrp = Number(it.mrp || 0);
          return sum + ((mrp > sp ? mrp : sp) * Number(it.qty || 1));
        }, 0);
        const modalProductSavings = modalItems.reduce((sum, it) => {
          const sp = Number(it.sellingPrice || 0);
          const mrp = Number(it.mrp || 0);
          return sum + (mrp > sp ? (mrp - sp) * Number(it.qty || 1) : 0);
        }, 0);
        const modalBillDiscount = Number(checkoutResult.discountAmount || 0);
        const modalTotalSavings = modalProductSavings + modalBillDiscount;
        const modalSavingsPercent = modalTotalMrp > 0 ? Math.round((modalTotalSavings / modalTotalMrp) * 100) : 0;
        const shopGst = shopData?.gstNumber || '27AABCS1429B1Z2';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200 p-4 no-print">
            <div className="bg-card text-card-foreground p-0 rounded-2xl border shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200" id="receipt-modal">
              {/* Green Header */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white text-center no-print">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-95 animate-bounce duration-1000" />
                <h2 className="text-2xl font-black">Checkout Complete</h2>
                <p className="text-xl font-bold mt-0.5">Bill Total: ₹{checkoutResult.total.toFixed(2)}</p>
                {modalTotalSavings > 0 && (
                  <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold mt-2 shadow-sm">
                    <span>🎉 Customer Saved ₹{modalTotalSavings.toFixed(2)} ({modalSavingsPercent}% OFF)!</span>
                  </div>
                )}
              </div>

              {/* WhatsApp Status Banner in Modal */}
              {whatsappStatusBanner && (
                <div className={`mx-4 mt-3 p-3 rounded-xl border flex items-center gap-3 text-sm animate-in fade-in duration-300 ${
                  whatsappStatusBanner.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : whatsappStatusBanner.type === 'error'
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
                    : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                }`}>
                  {whatsappStatusBanner.type === 'loading' ? (
                    <Loader2 className="h-5 w-5 animate-spin shrink-0 text-blue-600 dark:text-blue-400" />
                  ) : whatsappStatusBanner.type === 'error' ? (
                    <X className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <div className="flex-1 font-semibold text-xs leading-tight">
                    {whatsappStatusBanner.message}
                    {pendingWhatsApp && pendingWhatsApp.countdown > 0 && (
                      <span className="ml-1 text-blue-600 dark:text-blue-400">({pendingWhatsApp.countdown}s)</span>
                    )}
                  </div>
                  {pendingWhatsApp && pendingWhatsApp.countdown > 0 && (
                    <button
                      onClick={() => { setPendingWhatsApp(null); setWhatsappStatusBanner(null); }}
                      className="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  {whatsappStatusBanner.type !== 'loading' && (
                    <button
                      onClick={() => setWhatsappStatusBanner(null)}
                      className="text-muted-foreground hover:text-foreground ml-auto"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Scrollable Modal Content */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(92vh-180px)]">
                {/* Mini Bill Preview */}
                <div className="bg-muted/40 rounded-xl p-3.5 border text-xs space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-dashed">
                    <div>
                      <div className="font-bold text-sm text-foreground uppercase">{shopData?.shopName || shopData?.name || 'Kirana Store'}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">GSTIN: {shopGst}</div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-foreground">#{checkoutResult.id.slice(-8).toUpperCase()}</span>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">{checkoutResult.paymentMethod || 'Cash'}</div>
                    </div>
                  </div>

                  {/* Items Summary */}
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {modalItems.map((item, idx) => {
                      const sp = Number(item.sellingPrice || 0);
                      const mrp = Number(item.mrp || 0);
                      const qty = Number(item.qty || 1);
                      const hasDiscount = mrp > sp;
                      const itemSavings = hasDiscount ? (mrp - sp) * qty : 0;
                      return (
                        <div key={idx} className="flex justify-between items-start py-0.5 border-b border-border/40 last:border-0">
                          <div className="flex-1 pr-2">
                            <span className="font-medium text-foreground">{item.name}</span>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <span>₹{sp.toFixed(2)} x {qty}</span>
                              {hasDiscount && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">(Saved ₹{itemSavings.toFixed(2)})</span>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-foreground">₹{(sp * qty).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bill Totals in Mini Preview */}
                  <div className="pt-2 border-t border-dashed space-y-1 text-[11px]">
                    {modalTotalMrp > checkoutResult.total && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total MRP:</span>
                        <span>₹{modalTotalMrp.toFixed(2)}</span>
                      </div>
                    )}
                    {modalTotalSavings > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                        <span>Total Savings:</span>
                        <span>- ₹{modalTotalSavings.toFixed(2)} ({modalSavingsPercent}% OFF)</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-foreground text-xs pt-1 border-t">
                      <span>Grand Total:</span>
                      <span>₹{checkoutResult.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* UPI QR Code Block */}
                {shopData?.upiId ? (
                  <div className={`flex flex-col items-center justify-center space-y-3 p-3.5 rounded-xl border transition-all duration-300 ${
                    paymentVerified 
                      ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900' 
                      : 'bg-muted/30 border-muted relative overflow-hidden'
                  }`}>
                    {!paymentVerified && (
                      <div className="absolute inset-0 pointer-events-none opacity-20">
                        <div className="w-full h-[2px] bg-primary animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(var(--primary),0.8)]"></div>
                      </div>
                    )}

                    <div className={`flex items-center gap-2 font-medium text-xs transition-colors ${paymentVerified ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {paymentVerified ? (
                        <><CheckCircle2 className="h-4 w-4" /> Payment Verified Successfully</>
                      ) : (
                        <><Loader2 className="h-4 w-4 animate-spin" /> UPI QR (Scan & Pay)</>
                      )}
                    </div>
                    
                    <div className={`bg-white p-2.5 rounded-xl shadow-sm border transition-all duration-500 ${paymentVerified ? 'scale-90 opacity-50 blur-[2px]' : 'scale-100 opacity-100'}`}>
                      <QRCodeSVG 
                        value={`upi://pay?pa=${shopData.upiId}&pn=${encodeURIComponent(shopData.shopName || shopData.name || 'Store')}&am=${checkoutResult.total.toFixed(2)}&cu=INR`} 
                        size={140} 
                        level="H"
                      />
                    </div>
                    
                    {!paymentVerified ? (
                      <Button 
                        variant="default" 
                        className="w-full h-9 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 shadow-none"
                        onClick={() => setPaymentVerified(true)}
                      >
                        Verify Manually
                      </Button>
                    ) : (
                      <p className="text-[11px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">Transaction Complete</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-xs text-muted-foreground bg-orange-50 dark:bg-orange-950/40 p-2.5 rounded-lg border border-orange-200 dark:border-orange-900">
                    Add your UPI ID in Settings to generate payment QR codes automatically!
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 no-print pt-1">
                  <Button 
                    variant="outline" 
                    className="h-11 w-full flex gap-1 font-medium px-2 relative text-xs" 
                    onClick={handleWhatsAppBill}
                  >
                    <MessageCircle className="h-4 w-4 text-green-500 shrink-0" /> WhatsApp
                    {!canAccess('whatsapp_bills') && (
                      <span className="ml-1 text-[8px] bg-amber-500/20 text-amber-500 px-1 py-0.2 rounded font-black">
                        🔒 Plus
                      </span>
                    )}
                  </Button>
                  <Button variant="outline" className="h-11 w-full flex gap-1 font-medium px-2 text-xs" onClick={handlePrintReceipt}>
                    <Printer className="h-4 w-4 text-blue-500 shrink-0" /> Print Bill
                  </Button>
                  <Button className="h-11 w-full font-bold px-2 text-xs" onClick={() => setCheckoutResult(null)}>
                    New Bill
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
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
      <div className={`flex-1 flex flex-col gap-3.5 min-w-0 md:h-full md:overflow-hidden ${cart.length > 0 ? 'pb-36' : 'pb-24'} md:pb-0`}>
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input 
            ref={searchInputRef}
            placeholder="वस्तू शोधा किंवा बारकोड स्कॅन करा..." 
            className="pl-11 pr-36 h-12 md:h-14 text-sm md:text-base shadow-xs rounded-2xl font-medium bg-background border-border/80"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const term = searchTerm.trim().toLowerCase();
                if (!term) return;

                // 1. Exact match on shortCode, barcode, or sku
                const exactMatch = products.find(p => 
                  ((p as any).shortCode && String((p as any).shortCode).trim().toLowerCase() === term) ||
                  (p.barcode && p.barcode.trim().toLowerCase() === term) ||
                  (p.sku && p.sku.trim().toLowerCase() === term)
                );

                if (exactMatch) {
                  addToCart(exactMatch);
                  setSearchTerm('');
                  e.preventDefault();
                  return;
                }

                // 2. Fallback to first filtered product
                if (filteredProducts.length > 0) {
                  addToCart(filteredProducts[0]);
                  setSearchTerm('');
                  e.preventDefault();
                }
              }
            }}
            autoFocus
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              title="Scan Parchi (List)"
              className="rounded-xl shadow-2xs hover:border-blue-500/50 text-blue-600 bg-blue-50/80 dark:bg-blue-900/20 dark:text-blue-400 h-9 w-9"
              onClick={() => setShowParchiModal(true)}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Barcode Scanner"
              className="rounded-xl shadow-2xs hover:border-primary/50 text-primary bg-primary/5 h-9 w-9"
              onClick={() => setShowScanner(true)}
            >
              <Barcode className="h-4 w-4" />
            </Button>
            {voiceSupported && (
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-xl transition-all h-9 w-9 relative ${
                  isListening 
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse' 
                    : 'text-muted-foreground hover:text-primary hover:bg-muted'
                }`}
                onClick={handleVoiceSearch}
                title={canAccess('voice_billing') ? "MartGPT Voice Billing" : "Voice Billing (Pro Feature - Click to Upgrade)"}
              >
                <Mic className="h-4 w-4" />
                {!canAccess('voice_billing') && (
                  <span className="absolute -top-1 -right-1 text-[8px] bg-indigo-600 text-white font-black px-1 rounded-full shadow-xs">
                    PRO
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Category Tabs & WhatsApp Bot Live Indicator */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex gap-2">
            <Button 
              variant={activeTab === 'all' ? 'default' : 'outline'} 
              className="rounded-xl px-4 h-8 text-xs font-semibold whitespace-nowrap"
              onClick={() => setActiveTab('all')}
            >
              All Items ({products.length})
            </Button>
            <Button 
              variant={activeTab === 'loose' ? 'default' : 'outline'} 
              className="rounded-xl px-4 h-8 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5"
              onClick={() => setActiveTab('loose')}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Loose (सुट्टे)
            </Button>
            <Button 
              variant={activeTab === 'barcoded' ? 'default' : 'outline'} 
              className="rounded-xl px-4 h-8 text-xs font-semibold whitespace-nowrap"
              onClick={() => setActiveTab('barcoded')}
            >
              Barcoded
            </Button>
          </div>

          <div className="shrink-0">
            {liveWaStatus === 'CONNECTED' || liveWaStatus === 'AUTHENTICATED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-950/80 dark:text-green-300 border border-green-300 dark:border-green-800 shadow-2xs" title="Auto WhatsApp Bot सक्रिय आहे.">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <Smartphone className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> WhatsApp Active
              </span>
            ) : (
              <Link to="/settings" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 transition-colors shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <Smartphone className="w-3.5 h-3.5 text-amber-600" /> Bot Offline
              </Link>
            )}
          </div>
        </div>

        {/* Compact Quick Loose Items Strip */}
        {looseQuickItems.length > 0 && (
          <div className="bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300/40 dark:border-amber-800/40 rounded-xl p-2.5 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 dark:text-amber-200">
                <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>⚡ जलद वस्तू (Quick Click):</span>
              </div>
              <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                {looseQuickItems.length} आयटम
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {looseQuickItems.slice(0, 15).map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item)}
                  className="shrink-0 flex items-center gap-1.5 bg-background hover:bg-amber-100/70 dark:hover:bg-amber-900/40 border border-amber-200/80 dark:border-amber-800/80 rounded-lg px-2.5 py-1 shadow-2xs transition-all active:scale-95 group text-left"
                  title={`क्लिक करा किंवा कोड ${(item as any).shortCode || item.barcode || ''} दाबून Enter करा`}
                >
                  {((item as any).shortCode) && (
                    <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded font-mono">
                      {(item as any).shortCode}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-foreground truncate max-w-[110px]">{item.name}</span>
                  <span className="text-xs font-bold text-primary shrink-0">₹{item.sellingPrice}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Clean, Compact Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.map(product => {
            const isLoose = Boolean((product as any).isLoose);
            const shortCode = (product as any).shortCode;
            
            return (
              <div 
                key={product.id} 
                className="group relative border border-border/80 rounded-2xl p-3 sm:p-3.5 cursor-pointer hover:border-primary/60 hover:shadow-md transition-all duration-200 bg-card text-card-foreground flex flex-col justify-between active:scale-[0.98]"
                onClick={() => addToCart(product)}
              >
                {/* Top Badges */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  {shortCode ? (
                    <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono font-bold text-[10px] px-2 py-0.5 rounded-md border border-amber-500/30">
                      ⚡ {shortCode}
                    </span>
                  ) : isLoose ? (
                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[10px] px-2 py-0.5 rounded-md">
                      Loose
                    </span>
                  ) : (
                    <span className="bg-muted text-muted-foreground font-medium text-[10px] px-1.5 py-0.5 rounded-md truncate max-w-[90px]">
                      {product.category || 'Item'}
                    </span>
                  )}

                  <span className="text-[10px] font-medium text-muted-foreground ml-auto">
                    {product.stock} {product.unit || 'pcs'}
                  </span>
                </div>

                {/* Image if available */}
                {product.imageUrl ? (
                  <div className="h-20 w-full mb-2 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-border/40">
                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-1 group-hover:scale-105 transition-transform" />
                  </div>
                ) : null}

                {/* Name */}
                <h3 className="font-semibold text-xs sm:text-sm text-foreground line-clamp-2 leading-snug mb-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>

                {/* Bottom Price & Add */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-auto">
                  <div>
                    <p className="font-black text-sm sm:text-base text-primary">₹{product.sellingPrice}</p>
                    {product.mrp && product.mrp > product.sellingPrice ? (
                      <p className="text-[10px] text-muted-foreground line-through">₹{product.mrp}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="h-7 w-7 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-all shrink-0"
                    title="Add to Bill"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Floating Cart Summary - Only visible when cart has items */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-[64px] left-0 right-0 p-3 bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_25px_rgba(0,0,0,0.18)] z-30 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <div className="flex-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{cart.reduce((s, i) => s + i.qty, 0)} Items</p>
              <p className="text-xl font-black text-foreground">₹{total.toFixed(2)}</p>
            </div>
            <Button 
              className="flex-1 h-12 text-base font-bold shadow-md bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 rounded-xl"
              onClick={() => setShowMobileCart(true)}
            >
              <ShoppingCart className="mr-2 h-5 w-5" /> View Bill ({cart.length})
            </Button>
          </div>
        </div>
      )}

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
                    <p className="mt-4 font-bold text-blue-600 animate-pulse">{parchiText || 'Reading handwriting...'}</p>
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
        md:static md:w-[380px] lg:w-[420px] md:bg-card md:text-card-foreground md:rounded-2xl md:border md:shadow-sm md:h-full md:overflow-hidden md:z-auto shrink-0
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-3 sm:p-4">
          <div className="bg-card text-card-foreground p-5 sm:p-6 rounded-3xl border shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-black text-foreground">पेमेंट पर्याय (Payment Option)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">रोख, UPI किंवा उधारीचे वाटप करा</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowPaymentModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Total Bill Banner & 1-Click Presets */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-2xl shadow-md space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-blue-100 uppercase tracking-wider block">एकूण बिल (Total Bill)</span>
                  <span className="text-2xl font-black">₹{total.toFixed(2)}</span>
                </div>
                {/* 1-Click Quick Presets */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/20">
                  <button
                    type="button"
                    onClick={() => setSplitAmounts({ cash: total, upi: 0, udhar: 0 })}
                    className="text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white py-1.5 px-1 rounded-xl transition-all text-center"
                  >
                    💵 सर्व Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitAmounts({ cash: 0, upi: total, udhar: 0 })}
                    className="text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white py-1.5 px-1 rounded-xl transition-all text-center"
                  >
                    📱 सर्व UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitAmounts({ cash: 0, upi: 0, udhar: total })}
                    className="text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white py-1.5 px-1 rounded-xl transition-all text-center"
                  >
                    📝 सर्व उधारी
                  </button>
                </div>
              </div>
              
              {/* Customer Mobile for WhatsApp & Udhar */}
              <div className="flex flex-col gap-1 bg-muted/40 p-3 rounded-2xl border border-border">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-foreground">
                    ग्राहक मोबाईल नंबर {splitAmounts.udhar > 0 ? <span className="text-red-500 font-extrabold">* (उधारीसाठी आवश्यक)</span> : '(WhatsApp बिलासाठी)'}
                  </Label>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${customerPhone.length === 10 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 font-bold' : 'text-muted-foreground'}`}>
                    {customerPhone.length}/10
                  </span>
                </div>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                    +91
                  </span>
                  <Input 
                    type="tel" 
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={customerPhone} 
                    onChange={(e) => {
                      const val = cleanPhone(e.target.value);
                      setCustomerPhone(val);
                    }}
                    className={`h-10 pl-10 font-mono text-sm bg-background ${splitAmounts.udhar > 0 && !customerPhone ? 'border-red-500 ring-2 ring-red-500/20' : ''}`}
                  />
                </div>
              </div>

              {/* Auto remainder checkbox */}
              <div className="flex items-center justify-between p-2.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-800/60 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-bold text-amber-950 dark:text-amber-200">
                    कॅश दिल्यावर बाकी रक्कम आपोआप उधारीत टाका
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoRemainderToUdhar}
                  onChange={(e) => setAutoRemainderToUdhar(e.target.checked)}
                  className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
              </div>

              {/* Split Inputs */}
              <div className="space-y-3">
                {/* Cash Input */}
                <div className="flex items-center gap-2">
                  <Label className="w-16 font-bold text-sm text-foreground">Cash:</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold">₹</span>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00"
                      value={splitAmounts.cash || ''} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (autoRemainderToUdhar) {
                          const rem = Math.max(0, Number((total - val - splitAmounts.upi).toFixed(2)));
                          setSplitAmounts({ cash: val, upi: splitAmounts.upi, udhar: rem });
                        } else {
                          setSplitAmounts(p => ({ ...p, cash: val }));
                        }
                      }}
                      className="pl-7 font-black text-lg h-11 bg-background"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-11 px-2.5 shrink-0"
                    title="बाकी रक्कम रोख टाका"
                    onClick={() => {
                      const rem = Math.max(0, Number((total - splitAmounts.upi - splitAmounts.udhar).toFixed(2)));
                      setSplitAmounts(p => ({ ...p, cash: rem }));
                    }}
                  >
                    बाकी
                  </Button>
                </div>

                {/* UPI Input */}
                <div className="flex items-center gap-2">
                  <Label className="w-16 font-bold text-sm text-foreground">UPI:</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold">₹</span>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00"
                      value={splitAmounts.upi || ''} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (autoRemainderToUdhar) {
                          const rem = Math.max(0, Number((total - splitAmounts.cash - val).toFixed(2)));
                          setSplitAmounts({ cash: splitAmounts.cash, upi: val, udhar: rem });
                        } else {
                          setSplitAmounts(p => ({ ...p, upi: val }));
                        }
                      }}
                      className="pl-7 font-black text-lg h-11 bg-background"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-11 px-2.5 shrink-0"
                    title="बाकी रक्कम UPI टाका"
                    onClick={() => {
                      const rem = Math.max(0, Number((total - splitAmounts.cash - splitAmounts.udhar).toFixed(2)));
                      setSplitAmounts(p => ({ ...p, upi: rem }));
                    }}
                  >
                    बाकी
                  </Button>
                </div>

                {/* Udhar Input */}
                <div className="flex items-center gap-2">
                  <Label className="w-16 font-bold text-sm text-orange-600 dark:text-orange-400">उधारी:</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold">₹</span>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00"
                      value={splitAmounts.udhar || ''} 
                      onChange={(e) => setSplitAmounts(p => ({ ...p, udhar: parseFloat(e.target.value) || 0 }))}
                      className="pl-7 font-black text-lg h-11 bg-background border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-11 px-2.5 shrink-0 border-orange-300 text-orange-600 hover:bg-orange-50 font-bold"
                    title="बाकी सर्व रक्कम उधारीत टाका"
                    onClick={() => {
                      const rem = Math.max(0, Number((total - splitAmounts.cash - splitAmounts.upi).toFixed(2)));
                      setSplitAmounts(p => ({ ...p, udhar: rem }));
                    }}
                  >
                    + उधारी
                  </Button>
                </div>

                {/* Remaining Amount Box if difference exists */}
                {(() => {
                  const currentSum = Number((splitAmounts.cash + splitAmounts.upi + splitAmounts.udhar).toFixed(2));
                  const diff = Number((total - currentSum).toFixed(2));
                  if (Math.abs(diff) < 0.01) {
                    return (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>रक्कम बरोबर जुळली! ({splitAmounts.cash > 0 ? `₹${splitAmounts.cash} रोख ` : ''}{splitAmounts.upi > 0 ? `+ ₹${splitAmounts.upi} UPI ` : ''}{splitAmounts.udhar > 0 ? `+ ₹${splitAmounts.udhar} उधारी ` : ''}= ₹{total.toFixed(2)})</span>
                      </div>
                    );
                  }
                  if (diff > 0) {
                    return (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl space-y-2 text-xs">
                        <div className="flex justify-between items-center font-bold text-amber-950 dark:text-amber-200">
                          <span>शिल्लक बाकी (Remaining):</span>
                          <span className="text-base font-black text-red-600">₹{diff.toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1 h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => setSplitAmounts(p => ({ ...p, udhar: Number((p.udhar + diff).toFixed(2)) }))}
                          >
                            + बाकी ₹{diff.toFixed(2)} उधारीत जोडा
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-bold border-amber-300"
                            onClick={() => setSplitAmounts(p => ({ ...p, upi: Number((p.upi + diff).toFixed(2)) }))}
                          >
                            + UPI मध्ये
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-xs font-bold text-red-600 text-center">
                      जास्त रक्कम झाली आहे: एकूण बिलापेक्षा ₹{Math.abs(diff).toFixed(2)} जास्त टाकले आहेत.
                    </div>
                  );
                })()}

                {/* Udhar Customer Details */}
                {splitAmounts.udhar > 0 && (
                  <div className="pt-2 border-t border-dashed mt-2 space-y-3">
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
                      उधारी ग्राहक तपशील (Udhar Details)
                    </p>
                    <div className="flex items-center gap-3">
                      <Label className="w-20 text-xs">Aadhar:</Label>
                      <Input 
                        placeholder="Aadhar Number (Optional)" 
                        value={customerAadhar} 
                        onChange={(e) => setCustomerAadhar(e.target.value)}
                        className="flex-1 text-sm h-9"
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
                          <div className="relative h-9 flex-1 border rounded-lg bg-muted/50 flex items-center justify-center text-xs text-muted-foreground cursor-pointer overflow-hidden">
                            <Camera className="h-4 w-4 mr-1" /> Take Photo
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const compressed = await compressImage(file, 600, 600, 0.7);
                                    setCustomerPhoto(compressed);
                                  } catch {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setCustomerPhoto(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
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
                  <p className="text-xs text-red-500 font-bold text-center bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200">
                    ⚠️ 10-digit customer mobile number is required for Udhar credit!
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t mt-4 flex gap-2">
              <Button 
                variant="outline" 
                className="w-1/3 h-12 font-bold text-sm"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </Button>
              <Button 
                className="w-2/3 h-12 text-base font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white shadow-lg"
                onClick={() => {
                  setShowPaymentModal(false);
                  let mainMethod: 'cash' | 'upi' | 'udhar' | 'split' = 'split';
                  if (Math.abs(splitAmounts.cash - total) < 0.01) mainMethod = 'cash';
                  else if (Math.abs(splitAmounts.upi - total) < 0.01) mainMethod = 'upi';
                  else if (Math.abs(splitAmounts.udhar - total) < 0.01) mainMethod = 'udhar';
                  
                  handleCheckout(mainMethod, splitAmounts);
                }}
                disabled={
                  checkoutLoading || 
                  (splitAmounts.udhar > 0 && !customerPhone) || 
                  Math.abs(Number((splitAmounts.cash + splitAmounts.upi + splitAmounts.udhar).toFixed(2)) - total) >= 0.01
                }
              >
                {checkoutLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : `बिल पूर्ण करा (₹${total.toFixed(2)})`}
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
      {checkoutResult && shopData && (() => {
        const receiptItems = checkoutResult.items || [];
        const totalItemsCount = receiptItems.length;
        const totalQtyCount = receiptItems.reduce((acc, it) => acc + Number(it.qty || 1), 0);
        const totalMrpValue = receiptItems.reduce((acc, it) => {
          const sp = Number(it.sellingPrice || 0);
          const mrp = Number(it.mrp || 0);
          const effectiveMrp = mrp > sp ? mrp : sp;
          return acc + (effectiveMrp * Number(it.qty || 1));
        }, 0);
        const totalProductSavings = receiptItems.reduce((acc, it) => {
          const sp = Number(it.sellingPrice || 0);
          const mrp = Number(it.mrp || 0);
          return acc + (mrp > sp ? (mrp - sp) * Number(it.qty || 1) : 0);
        }, 0);
        const billDiscountAmount = Number(checkoutResult.discountAmount || 0);
        const grandTotalSavings = totalProductSavings + billDiscountAmount;
        const savingsPercentage = totalMrpValue > 0 ? Math.round((grandTotalSavings / totalMrpValue) * 100) : 0;
        const taxVal = Number(checkoutResult.taxAmount || 0);
        const halfTax = taxVal / 2;
        const shopGst = shopData?.gstNumber || '27AABCS1429B1Z2';
        const formattedDate = new Date(checkoutResult.createdAt || Date.now()).toLocaleDateString('en-IN');
        const formattedTime = new Date(checkoutResult.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

        return (
          <div id="receipt-template" className="hidden print:block absolute left-0 top-0 w-[80mm] bg-white text-black text-[12px] leading-[1.3] font-mono z-0 p-3">
            {/* STORE HEADER */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <h2 style={{ margin: '0 0 2px 0', fontSize: '18px', fontWeight: '900', letterSpacing: '0.5px' }}>
                {(shopData.shopName || shopData.name || 'KIRANA STORE').toUpperCase()}
              </h2>
              {shopData.address && (
                <p style={{ margin: '2px 0', fontSize: '11px', lineHeight: '1.2' }}>{shopData.address}</p>
              )}
              {shopData.phone && (
                <p style={{ margin: '2px 0', fontSize: '11px' }}>Ph: {shopData.phone}</p>
              )}
              <p style={{ margin: '3px 0', fontSize: '12px', fontWeight: 'bold' }}>
                GSTIN: {shopGst}
              </p>
              {(shopData as any).fssaiNumber && (
                <p style={{ margin: '2px 0', fontSize: '11px' }}>FSSAI Lic: {(shopData as any).fssaiNumber}</p>
              )}
              <div style={{ margin: '6px 0 2px 0', fontWeight: 'bold', fontSize: '12px', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '3px 0' }}>
                *** RETAIL TAX INVOICE ***
              </div>
            </div>

            {/* INVOICE METADATA */}
            <div style={{ fontSize: '11px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Inv No:</strong> #{checkoutResult.id.slice(-8).toUpperCase()}</span>
                <span><strong>Date:</strong> {formattedDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Time:</strong> {formattedTime}</span>
                <span><strong>Pay Mode:</strong> {(checkoutResult.paymentMethod || 'CASH').toUpperCase()}</span>
              </div>
              {checkoutResult.customerPhone && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>Customer:</strong> +91 {checkoutResult.customerPhone}</span>
                </div>
              )}
            </div>

            <div style={{ borderBottom: '1px dashed #000', marginBottom: '6px' }}></div>

            {/* TABLE HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #000', paddingBottom: '3px', marginBottom: '4px' }}>
              <span style={{ width: '48%' }}>ITEM / RATE</span>
              <span style={{ width: '18%', textAlign: 'center' }}>QTY</span>
              <span style={{ width: '34%', textAlign: 'right' }}>AMOUNT</span>
            </div>

            {/* ITEMS LIST */}
            <div style={{ marginBottom: '6px' }}>
              {receiptItems.map((item, idx) => {
                const sp = Number(item.sellingPrice || 0);
                const mrp = Number(item.mrp || 0);
                const qty = Number(item.qty || 1);
                const itemTotal = sp * qty;
                const hasDiscount = mrp > sp;
                const itemSavings = hasDiscount ? (mrp - sp) * qty : 0;
                const discPercent = hasDiscount ? Math.round(((mrp - sp) / mrp) * 100) : 0;
                const unitStr = item.unit ? ` (${item.unit})` : '';

                return (
                  <div key={item.id || idx} style={{ marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px dotted #ccc' }}>
                    {/* Item Name */}
                    <div style={{ fontWeight: 'bold', fontSize: '11px', lineHeight: '1.2' }}>
                      {idx + 1}. {item.name}{unitStr}
                    </div>
                    
                    {/* Rate & Qty & Total Amount */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginTop: '2px' }}>
                      <span style={{ width: '48%' }}>
                        Rate: ₹{sp.toFixed(2)}
                        {hasDiscount && (
                          <span style={{ textDecoration: 'line-through', color: '#555', marginLeft: '4px', fontSize: '10px' }}>
                            ₹{mrp.toFixed(2)}
                          </span>
                        )}
                      </span>
                      <span style={{ width: '18%', textAlign: 'center' }}>
                        {qty}
                      </span>
                      <span style={{ width: '34%', textAlign: 'right', fontWeight: 'bold' }}>
                        ₹{itemTotal.toFixed(2)}
                      </span>
                    </div>

                    {/* Per-Item Discount & Savings */}
                    {hasDiscount && (
                      <div style={{ fontSize: '10px', color: '#000', paddingLeft: '8px', marginTop: '1px', fontStyle: 'italic' }}>
                        ↳ Discount: ₹{(mrp - sp).toFixed(2)}/u ({discPercent}% OFF) | Save ₹{itemSavings.toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

            {/* TOTALS & BREAKDOWN */}
            <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Items / Qty:</span>
                <span>{totalItemsCount} items / {totalQtyCount} qty</span>
              </div>

              {totalMrpValue > checkoutResult.total && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total MRP Value:</span>
                  <span>₹{totalMrpValue.toFixed(2)}</span>
                </div>
              )}

              {totalProductSavings > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Product Discount:</span>
                  <span>-₹{totalProductSavings.toFixed(2)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal (Taxable):</span>
                <span>₹{checkoutResult.subtotal.toFixed(2)}</span>
              </div>

              {billDiscountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Special Bill Discount:</span>
                  <span>-₹{billDiscountAmount.toFixed(2)}</span>
                </div>
              )}

              {taxVal > 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>CGST:</span>
                    <span>+₹{halfTax.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>SGST:</span>
                    <span>+₹{halfTax.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#444' }}>
                  <span>GST:</span>
                  <span>Included in prices</span>
                </div>
              )}
            </div>

            <div style={{ borderBottom: '2px solid #000', margin: '6px 0' }}></div>

            {/* NET GRAND TOTAL */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '16px', padding: '2px 0' }}>
              <span>NET TOTAL:</span>
              <span>₹{checkoutResult.total.toFixed(2)}</span>
            </div>

            <div style={{ borderBottom: '2px solid #000', margin: '6px 0' }}></div>

            {/* SAVINGS BANNER */}
            {grandTotalSavings > 0 && (
              <div style={{ 
                border: '1.5px solid #000', 
                padding: '6px 4px', 
                textAlign: 'center', 
                margin: '8px 0', 
                fontWeight: 'bold',
                fontSize: '11px',
                background: '#f9f9f9'
              }}>
                <div style={{ fontSize: '12px' }}>🎉 YOU SAVED ₹{grandTotalSavings.toFixed(2)} ({savingsPercentage}%)! 🎉</div>
                <div style={{ fontSize: '10px', fontWeight: 'normal', marginTop: '2px' }}>
                  (या बिलावर तुमची ₹{grandTotalSavings.toFixed(2)} रुपयांची बचत झाली!)
                </div>
              </div>
            )}

            {/* LOYALTY POINTS */}
            {(checkoutResult.loyaltyPointsEarned ?? 0) > 0 && (
              <div style={{ textAlign: 'center', margin: '4px 0', fontWeight: 'bold', fontSize: '11px' }}>
                ⭐ You earned {checkoutResult.loyaltyPointsEarned} Loyalty Points!
              </div>
            )}

            {/* FOOTER */}
            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px', borderTop: '1px dashed #000', paddingTop: '6px', lineHeight: '1.4' }}>
              <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Thank You For Shopping!</p>
              <p style={{ margin: '2px 0' }}>Please Visit Again 🙏</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '9px', color: '#666' }}>Software by Nayashi Kirana POS</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
