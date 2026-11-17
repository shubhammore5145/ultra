import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { 
  Search, Plus, Minus, Trash, IndianRupee, FileText, ShoppingCart, 
  Loader2, X, CheckCircle2, MessageCircle, Mic, Camera, Printer, 
  Barcode, Smartphone, Sparkles, Clock, Send, User, AlertTriangle, UserCheck,
  RotateCcw, BadgePercent, Calculator, Receipt, ShieldAlert,
  Coins, Wallet
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CameraScanner } from '../components/CameraScanner';
import Tesseract from 'tesseract.js';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import type { Product, CartItem, Customer } from '../types';
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
  
  // Customer Selection & Auto-suggest State
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const cached = localStorage.getItem('pos_customers_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const modalCustomerDropdownRef = useRef<HTMLDivElement>(null);

  // Stock Warning Notification
  const [stockWarning, setStockWarning] = useState<string>('');

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
    cashTendered?: number,
    changeReturn?: number,
    items: CartItem[], 
    customerName?: string,
    customerPhone: string,
    loyaltyPointsEarned?: number,
    createdAt?: string
  } | null>(null);

  const [lastBill, setLastBill] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('pos_last_bill');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Camera Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const [showScannerMenu, setShowScannerMenu] = useState(false);
  const [showPhysicalScannerReady, setShowPhysicalScannerReady] = useState(false);

  // Split Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({ cash: 0, upi: 0, udhar: 0 });
  const [cashTendered, setCashTendered] = useState('');
  const [cartCashReceived, setCartCashReceived] = useState('');
  const [customerAadhar, setCustomerAadhar] = useState('');
  const [customerPhoto, setCustomerPhoto] = useState('');
  const [autoRemainderToUdhar, setAutoRemainderToUdhar] = useState(true);

  // D-Mart Enterprise Pricing Mode (Retail vs Wholesale)
  const [pricingMode, setPricingMode] = useState<'retail' | 'wholesale'>('retail');

  // D-Mart Sales Return & Exchange State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnSearchTerm, setReturnSearchTerm] = useState('');
  const [returnAllTransactions, setReturnAllTransactions] = useState<any[]>([]);
  const [selectedReturnTx, setSelectedReturnTx] = useState<any | null>(null);
  const [selectedReturnItem, setSelectedReturnItem] = useState<{ id: string; name: string; maxQty: number; price: number } | null>(null);
  const [returnQty, setReturnQty] = useState('1');
  const [returnReason, setReturnReason] = useState('Customer Exchange / Surplus');
  const [returnCondition, setReturnCondition] = useState<'resellable' | 'damaged'>('resellable');
  const [returnRefundMethod, setReturnRefundMethod] = useState<'cash' | 'udhar'>('cash');
  const [returnLoading, setReturnLoading] = useState(false);

  // D-Mart Cash Counter Shift Closing (Z-Report) State
  const [showShiftCloseModal, setShowShiftCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('0');
  const [denominations, setDenominations] = useState({
    d500: 0,
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10: 0,
    coins: 0
  });
  const [shiftClosingSaving, setShiftClosingSaving] = useState(false);
  const [shiftClosedSummary, setShiftClosedSummary] = useState<any | null>(null);

  const buildWhatsAppBillText = (
    txId: string, 
    billTotal: number, 
    phone: string, 
    itemsList: CartItem[] = checkoutResult?.items || [], 
    discount: number = checkoutResult?.discountAmount || 0,
    paymentMode: string = 'Paid',
    custName: string = ''
  ) => {
    const shopName = shopData?.shopName || shopData?.name || 'Kirana Store';
    const shopPhone = shopData?.phone ? `📞 Ph: ${shopData.phone}` : '';
    const shopAddr = shopData?.address ? `📍 ${shopData.address}` : '';
    const shopGst = (shopData?.gstNumber) ? `🏢 GSTIN: ${shopData.gstNumber}` : '';
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Determine public URL for digital receipt link
    let customPublicUrl = (shopData as any)?.publicUrl?.trim()?.replace(/\/$/, '');
    if (customPublicUrl && customPublicUrl.includes('vercel.app')) {
      customPublicUrl = 'https://ultra-u3ej.onrender.com';
    }
    if (!customPublicUrl && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      customPublicUrl = window.location.origin;
    }
    const finalBaseUrl = customPublicUrl || 'https://ultra-u3ej.onrender.com';
    const receiptLink = `${finalBaseUrl}/receipt/${txId}`;

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
    if (custName) {
      text += `*Customer:* ${custName} (+91 ${phone})\n`;
    }
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
      await api.whatsapp.sendBill(phone, text, txId.slice(0, 8), shopData?.shopId);
      const successMsg = `WhatsApp bill sent to +91 ${phone}! ✅`;
      setWhatsappStatusBanner({
        type: 'success',
        message: successMsg
      });
      setFloatingNotification(successMsg);
      setTimeout(() => setFloatingNotification(''), 7000);
      setTimeout(() => setWhatsappStatusBanner(null), 6000);
    } catch (err: any) {
      console.warn('WhatsApp bot send error, opening direct wa.me link:', err?.message);
      setWhatsappStatusBanner({
        type: 'error',
        message: `⚠️ Bot offline - opening direct WhatsApp...`
      });
      setTimeout(() => setWhatsappStatusBanner(null), 5000);
      try {
        const cleanPh = phone.replace(/[^0-9]/g, '').slice(-10);
        window.open(`https://wa.me/91${cleanPh}?text=${encodeURIComponent(text)}`, '_blank');
      } catch (openErr) {
        console.error('Failed to open wa.me link:', openErr);
      }
    }
  };

  // Poll WhatsApp Bot status for live indicator (specific to this shop)
  useEffect(() => {
    const checkWa = async () => {
      try {
        const data = await api.whatsapp.status(shopData?.shopId);
        setLiveWaStatus(data.status || 'DISCONNECTED');
      } catch {
        setLiveWaStatus('DISCONNECTED');
      }
    };
    checkWa();
    const interval = setInterval(checkWa, 7000);
    return () => clearInterval(interval);
  }, [shopData?.shopId]);

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

  // Fetch live customers for fast POS autocomplete
  useEffect(() => {
    let isMounted = true;
    const fetchCustomers = async () => {
      try {
        const custList = await api.customers.list();
        if (Array.isArray(custList) && isMounted) {
          setCustomers(custList);
          try {
            localStorage.setItem('pos_customers_cache', JSON.stringify(custList));
          } catch (e) {
            console.warn('Customer cache quota error', e);
          }
        }
      } catch (err) {
        console.warn('Failed to load customers for POS auto-complete', err);
      }
    };
    fetchCustomers();
    return () => { isMounted = false; };
  }, [shopData?.shopId]);

  // Outside click dismiss listener for customer suggestion dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        customerDropdownRef.current && 
        !customerDropdownRef.current.contains(e.target as Node) &&
        (!modalCustomerDropdownRef.current || !modalCustomerDropdownRef.current.contains(e.target as Node))
      ) {
        setShowCustomerSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter customer suggestions based on name or phone
  const customerSuggestions = useMemo(() => {
    const nameTerm = customerName.trim().toLowerCase();
    const phoneTerm = cleanPhone(customerPhone);
    
    // Search when at least 1 letter in name or 2 digits in phone
    if (!nameTerm && phoneTerm.length < 2) return [];

    return customers.filter(c => {
      const cName = (c.name || '').toLowerCase();
      const cPhone = cleanPhone(c.phone || '');
      const matchName = nameTerm.length > 0 && cName.includes(nameTerm);
      const matchPhone = phoneTerm.length >= 2 && cPhone.includes(phoneTerm);
      return matchName || matchPhone;
    }).slice(0, 6);
  }, [customers, customerName, customerPhone]);

  // Auto-match existing customer when 10 digits are typed
  useEffect(() => {
    const clean = cleanPhone(customerPhone);
    if (clean.length === 10) {
      const matched = customers.find(c => cleanPhone(c.phone || '') === clean);
      if (matched) {
        setSelectedCustomer(matched);
        if (!customerName || customerName === 'New Customer') {
          setCustomerName(matched.name || '');
        }
        setShowCustomerSuggestions(false);
      }
    }
  }, [customerPhone, customers, customerName]);

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustomerName(cust.name || '');
    setCustomerPhone(cleanPhone(cust.phone || ''));
    setShowCustomerSuggestions(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setShowCustomerSuggestions(false);
  };

  // Stock Warning Beep and Notification Alert
  const playWarningBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {}
  }, []);

  const triggerStockAlert = useCallback((msg: string) => {
    setStockWarning(msg);
    playWarningBeep();
  }, [playWarningBeep]);

  // Auto-dismiss stock alert after 4.5 seconds
  useEffect(() => {
    if (!stockWarning) return;
    const timer = setTimeout(() => {
      setStockWarning('');
    }, 4500);
    return () => clearTimeout(timer);
  }, [stockWarning]);

  const addToCart = useCallback((product: Product) => {
    const isLoose = Boolean((product as any).isLoose);
    const availableStock = Number(product.stock ?? 0);

    // If packaged product and stock is 0 or less, block adding
    if (!isLoose && availableStock <= 0) {
      triggerStockAlert(`⚠️ "${product.name}" is out of stock! (Available: 0)`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (!isLoose && existing.qty >= availableStock) {
          triggerStockAlert(`⚠️ "${product.name}" has only ${availableStock} in stock! Cannot exceed available stock.`);
          return prev;
        }
        const newQty = existing.qty + 1;
        let effectivePrice = Number(existing.sellingPrice);
        if (existing.bulkMinQty && existing.bulkPrice && newQty >= existing.bulkMinQty) {
          effectivePrice = Number(existing.bulkPrice);
        }
        return prev.map(item => 
          item.id === product.id ? { ...item, qty: newQty, sellingPrice: effectivePrice } : item
        );
      }

      const initialPrice = pricingMode === 'wholesale' && product.wholesalePrice && Number(product.wholesalePrice) > 0
        ? Number(product.wholesalePrice)
        : Number(product.sellingPrice) || 0;

      const itemToAdd: CartItem = {
        ...product,
        sellingPrice: initialPrice,
        purchasePrice: Number(product.purchasePrice) || 0,
        mrp: Number(product.mrp || product.sellingPrice) || 0,
        qty: 1,
        rateType: pricingMode === 'wholesale' ? 'wholesale' : 'retail'
      };
      return [...prev, itemToAdd];
    });
  }, [triggerStockAlert, pricingMode]);

  const handleBarcodeScan = useCallback((code: string): boolean => {
    // If the quick add modal is open, don't trigger another scan
    if (quickAddBarcode) return false;

    const trimmed = code.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();

    // Play supermarket scanner audio beep if enabled
    const scannerBeepEnabled = (shopData as any)?.settings?.scannerBeep !== false;
    if (scannerBeepEnabled) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1750, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } catch (e) {}
    }

    // Check exact match on shortCode, barcode, or sku
    const product = products.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === lower) ||
      ((p as any).shortCode && String((p as any).shortCode).trim().toLowerCase() === lower) ||
      (p.sku && p.sku.trim().toLowerCase() === lower)
    );

    if (product) {
      const isLoose = Boolean((product as any).isLoose);
      const availableStock = Number(product.stock ?? 0);
      const existingInCart = cart.find(c => c.id === product.id);
      const currentQty = existingInCart ? existingInCart.qty : 0;

      if (!isLoose && (availableStock <= 0 || currentQty >= availableStock)) {
        triggerStockAlert(`⚠️ "${product.name}" has only ${availableStock} in stock! Cannot add more.`);
        setShowPhysicalScannerReady(false);
        return false;
      }

      addToCart(product);
      setShowPhysicalScannerReady(false);
      setSearchTerm('');
      return true;
    } else {
      // Open Quick Add Modal and close camera so staff can immediately enter details
      setQuickAddBarcode(code);
      setQuickAddName('');
      setQuickAddPrice('');
      setShowPhysicalScannerReady(false);
      setShowScanner(false);
      return false;
    }
  }, [products, quickAddBarcode, addToCart, shopData, cart, triggerStockAlert]);

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
        const isLoose = Boolean((item as any).isLoose);
        const maxStock = Number(item.stock ?? 999999);
        const newQty = item.qty + delta;

        if (delta > 0 && !isLoose && newQty > maxStock) {
          triggerStockAlert(`⚠️ "${item.name}" has only ${maxStock} in stock! Cannot add more.`);
          return item;
        }

        if (newQty <= 0) return item;

        // Auto apply bulk discount tier if qty reaches threshold
        let effectivePrice = Number(item.sellingPrice);
        if (item.bulkMinQty && item.bulkPrice && newQty >= item.bulkMinQty) {
          effectivePrice = Number(item.bulkPrice);
        } else if (item.bulkMinQty && newQty < item.bulkMinQty) {
          const orig = products.find(p => p.id === item.id);
          effectivePrice = pricingMode === 'wholesale' && orig?.wholesalePrice
            ? Number(orig.wholesalePrice)
            : Number(orig?.sellingPrice || item.sellingPrice);
        }

        return { ...item, qty: newQty, sellingPrice: effectivePrice };
      }
      return item;
    }));
  };

  const togglePricingMode = () => {
    const nextMode = pricingMode === 'retail' ? 'wholesale' : 'retail';
    setPricingMode(nextMode);
    setCart(prev => prev.map(item => {
      const orig = products.find(p => p.id === item.id);
      let price = Number(orig?.sellingPrice || item.sellingPrice);
      if (nextMode === 'wholesale' && orig?.wholesalePrice) {
        price = Number(orig.wholesalePrice);
      }
      if (item.bulkMinQty && item.bulkPrice && item.qty >= item.bulkMinQty) {
        price = Number(item.bulkPrice);
      }
      return {
        ...item,
        sellingPrice: price,
        rateType: nextMode
      };
    }));
  };

  // Open Sales Return Modal
  const openReturnModal = async () => {
    setShowReturnModal(true);
    setReturnLoading(true);
    try {
      const txs = await api.transactions.list();
      setReturnAllTransactions(Array.isArray(txs) ? txs : []);
    } catch (e) {
      console.error('Failed to load transactions for return', e);
    } finally {
      setReturnLoading(false);
    }
  };

  // Submit Sales Return
  const handleProcessSalesReturn = async () => {
    if (!selectedReturnTx || !selectedReturnItem) return;
    const qtyToReturn = parseFloat(returnQty) || 0;
    if (qtyToReturn <= 0 || qtyToReturn > selectedReturnItem.maxQty) {
      alert(`Please enter a valid quantity between 1 and ${selectedReturnItem.maxQty}.`);
      return;
    }

    setReturnLoading(true);
    try {
      const refundTotal = qtyToReturn * selectedReturnItem.price;
      const targetProd = products.find(p => p.id === selectedReturnItem.id || p.name === selectedReturnItem.name);

      if (targetProd) {
        if (returnCondition === 'resellable') {
          const newStock = (targetProd.stock || 0) + qtyToReturn;
          await api.products.update(targetProd.id, { ...targetProd, stock: newStock });
          await api.stockMovements.log({
            productId: targetProd.id,
            productName: targetProd.name,
            changeQty: qtyToReturn,
            newStock,
            type: 'return',
            reason: `Return from Invoice #${selectedReturnTx.id?.slice(0, 8)}`,
            staffName: 'Cashier'
          });
        } else {
          await api.damagedGoods.create({
            productId: targetProd.id,
            productName: targetProd.name,
            qty: qtyToReturn,
            costPrice: targetProd.purchasePrice || 0,
            retailPrice: selectedReturnItem.price,
            reason: `Customer return: ${returnReason}`,
            reportedBy: 'Cashier'
          });
        }
      }

      await api.salesReturns.create({
        invoiceNumber: selectedReturnTx.id?.slice(0, 8) || 'TX-RET',
        customerName: selectedReturnTx.customerName || 'Walk-in Customer',
        customerPhone: selectedReturnTx.customerPhone || '',
        items: [{
          productId: targetProd?.id || selectedReturnItem.id,
          name: selectedReturnItem.name,
          qty: qtyToReturn,
          refundAmount: refundTotal,
          condition: returnCondition
        }],
        totalRefund: refundTotal,
        refundMethod: returnRefundMethod,
        reason: returnReason
      });

      const updatedProds = await api.products.list();
      setProducts(updatedProds);

      alert(`✅ Sales Return processed successfully! Refund amount: ₹${refundTotal.toFixed(2)} (${returnRefundMethod === 'cash' ? 'Cash Refund' : 'Credited to Customer Udhar'})`);
      setShowReturnModal(false);
      setSelectedReturnTx(null);
      setSelectedReturnItem(null);
      setReturnQty('1');
    } catch (err: any) {
      alert('Return failed: ' + (err.message || 'Error'));
    } finally {
      setReturnLoading(false);
    }
  };

  // Open Shift Close Modal
  const openShiftCloseModal = () => {
    setShowShiftCloseModal(true);
    setShiftClosedSummary(null);
  };

  // Calculate Shift Close Numbers
  const totalCountedCash = useMemo(() => {
    return (
      (denominations.d500 * 500) +
      (denominations.d200 * 200) +
      (denominations.d100 * 100) +
      (denominations.d50 * 50) +
      (denominations.d20 * 20) +
      (denominations.d10 * 10) +
      (Number(denominations.coins) || 0)
    );
  }, [denominations]);

  const handleSaveShiftClose = async () => {
    setShiftClosingSaving(true);
    try {
      const summary = {
        closedAt: new Date().toISOString(),
        cashierName: shopData?.name || 'Cashier',
        openingCash: parseFloat(openingCash) || 0,
        actualCash: totalCountedCash,
        notes: 'End of Shift Z-Report'
      };
      await api.cashCounter.closeShift(summary);
      setShiftClosedSummary(summary);
    } catch (e: any) {
      alert('Failed to save shift closing: ' + e.message);
    } finally {
      setShiftClosingSaving(false);
    }
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

  // Smart Quick Cash Suggestions (e.g. for bill ₹2589 -> ₹2600, ₹3000, ₹5000)
  const quickCashSuggestions = useMemo(() => {
    if (total <= 0) return [];
    const suggestions: number[] = [];
    const roundedUp10 = Math.ceil(total / 10) * 10;
    const roundedUp50 = Math.ceil(total / 50) * 50;
    const roundedUp100 = Math.ceil(total / 100) * 100;
    const roundedUp500 = Math.ceil(total / 500) * 500;

    if (roundedUp10 > total) suggestions.push(roundedUp10);
    if (roundedUp50 > total && !suggestions.includes(roundedUp50)) suggestions.push(roundedUp50);
    if (roundedUp100 > total && !suggestions.includes(roundedUp100)) suggestions.push(roundedUp100);
    if (roundedUp500 > total && !suggestions.includes(roundedUp500)) suggestions.push(roundedUp500);

    const commonNotes = [100, 200, 500, 1000, 2000, 3000, 5000];
    commonNotes.forEach(note => {
      if (note > total && !suggestions.includes(note)) {
        suggestions.push(note);
      }
    });

    return suggestions.sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  const handleCheckout = async (
    paymentMethod: 'cash' | 'upi' | 'udhar' | 'split' = 'cash', 
    splitAmounts?: { cash: number, upi: number, udhar: number },
    cashTenderedVal?: number,
    changeReturnVal?: number
  ) => {
    if (!shopData?.shopId || cart.length === 0) return;
    
    setCheckoutLoading(true);
    try {
      let finalCustomerId = selectedCustomer?.id || null;
      const phoneToSend = cleanPhone(customerPhone.trim());
      const nameToSend = customerName.trim() || selectedCustomer?.name || '';

      // 1. Check or Create Customer if phone is provided
      if (phoneToSend) {
        if (!finalCustomerId) {
          const matchedCust = customers.find(c => cleanPhone(c.phone || '') === phoneToSend);
          if (matchedCust) {
            finalCustomerId = matchedCust.id;
          }
        }

        if (finalCustomerId) {
          const existing = customers.find(c => c.id === finalCustomerId);
          if (existing) {
            const shouldUpdateName = nameToSend && (existing.name === 'New Customer' || !existing.name);
            if (shouldUpdateName || customerAadhar || customerPhoto) {
              await api.customers.update(finalCustomerId, {
                ...existing,
                name: shouldUpdateName ? nameToSend : existing.name,
                aadharNumber: customerAadhar || existing.aadharNumber,
                photoUrl: customerPhoto || existing.photoUrl
              });
            }
          }
        } else {
          finalCustomerId = crypto.randomUUID();
          const newCust = {
            id: finalCustomerId,
            name: nameToSend || 'New Customer',
            phone: phoneToSend,
            aadharNumber: customerAadhar,
            photoUrl: customerPhoto,
            address: '',
            balance: 0,
            createdAt: new Date().toISOString()
          };
          await api.customers.create(newCust);
          setCustomers(prev => [...prev, newCust as Customer]);
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
        cashTendered: cashTenderedVal,
        changeReturn: changeReturnVal,
        customerId: finalCustomerId,
        createdAt: new Date().toISOString()
      });

      // Cache full receipt in localStorage for instant offline access
      try {
        const fullReceiptObj = {
          id: txId,
          subtotal,
          discountAmount,
          totalAmount: total,
          taxAmount: tax,
          items: [...cart],
          paymentMethod,
          splitAmounts,
          cashTendered: cashTenderedVal,
          changeReturn: changeReturnVal,
          customerId: finalCustomerId,
          customerName: nameToSend,
          customerPhone: phoneToSend,
          shopName: shopData?.shopName || shopData?.name || 'Kirana Store',
          shopPhone: shopData?.phone || '',
          shopAddress: shopData?.address || '',
          shopGstNumber: shopData?.gstNumber || '',
          createdAt: new Date().toISOString()
        };
        localStorage.setItem(`receipt_${txId}`, JSON.stringify(fullReceiptObj));
        localStorage.setItem(`receipt_${txId.slice(0, 8)}`, JSON.stringify(fullReceiptObj));
      } catch (cacheErr) {}

      // Save result for the success modal & last-bill re-print
      const billDataToSave = {
        id: txId,
        subtotal,
        discountAmount,
        total,
        taxAmount: tax,
        paymentMethod: paymentMethod,
        splitAmounts: splitAmounts,
        cashTendered: cashTenderedVal,
        changeReturn: changeReturnVal,
        items: [...cart],
        customerName: nameToSend,
        customerPhone: phoneToSend,
        loyaltyPointsEarned: Math.floor(total / 100),
        createdAt: new Date().toISOString()
      };
      setCheckoutResult(billDataToSave);
      setLastBill(billDataToSave);
      try {
        localStorage.setItem('pos_last_bill', JSON.stringify(billDataToSave));
      } catch (e) {}
      setPaymentVerified(false);
      if (canAccess('audio_soundbox')) {
        playSoundboxAlert(total, paymentMethod);
      }

      // Auto-print thermal receipt if enabled in hardware settings
      const shouldAutoPrint = (shopData as any)?.settings?.autoPrintReceipt !== false;
      if (shouldAutoPrint) {
        setTimeout(() => {
          window.print();
        }, 500);
      }

      // Auto-send WhatsApp bill after configured delay if plan allows and customer phone is provided (10 digits)
      const billDelay = ((shopData as any)?.settings?.billDelaySeconds ?? 5);
      if (canAccess('whatsapp_bills') && phoneToSend.length === 10) {
        const billMsg = buildWhatsAppBillText(txId, total, phoneToSend, [...cart], discountAmount, paymentMethod, nameToSend);
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
      setCashTendered('');
      setCartCashReceived('');
      setSearchTerm('');
      setCustomerName('');
      setCustomerPhone('');
      setSelectedCustomer(null);
      setShowCustomerSuggestions(false);
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

  // Loose Items for quick buttons strip (Sugar, Peanuts, Rice etc.)
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
      'Paid',
      checkoutResult.customerName || ''
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

      {/* Floating Stock Limit Warning Notification */}
      {stockWarning && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[92%] sm:w-auto bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-rose-400 animate-in slide-in-from-top-4 duration-200">
          <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 animate-bounce" />
          <p className="text-sm font-bold flex-1">{stockWarning}</p>
          <button 
            type="button" 
            onClick={() => setStockWarning('')} 
            className="p-1 rounded-lg hover:bg-white/20 text-white/90 active:scale-90"
          >
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
        const shopGst = shopData?.gstNumber || '';

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

                {/* Change Return Highlight Card */}
                {Number(checkoutResult.changeReturn || 0) > 0 && (
                  <div className="mt-3.5 p-3.5 bg-white text-zinc-950 rounded-2xl shadow-lg border-2 border-emerald-400 flex items-center justify-between animate-in zoom-in-95">
                    <div className="text-left">
                      <span className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider block">
                        Change Due to Customer
                      </span>
                      <span className="text-2xl font-black text-emerald-600">
                        ₹{Number(checkoutResult.changeReturn).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right text-xs space-y-0.5">
                      <p className="text-zinc-600">Cash Tendered: <strong className="text-zinc-950 font-bold">₹{Number(checkoutResult.cashTendered || checkoutResult.total).toFixed(2)}</strong></p>
                      <p className="text-zinc-600">Bill Total: <strong className="text-zinc-950 font-bold">₹{checkoutResult.total.toFixed(2)}</strong></p>
                    </div>
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
                      {shopGst ? <div className="text-[11px] text-muted-foreground font-mono">GSTIN: {shopGst}</div> : null}
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-foreground">#{checkoutResult.id.slice(-8).toUpperCase()}</span>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">{checkoutResult.paymentMethod || 'Cash'}</div>
                    </div>
                  </div>

                  {(checkoutResult.customerName || checkoutResult.customerPhone) && (
                    <div className="text-[11px] bg-background/60 p-1.5 rounded-lg border border-border/40 flex justify-between items-center">
                      <span className="text-muted-foreground">Customer:</span>
                      <span className="font-semibold text-foreground">
                        {checkoutResult.customerName ? `${checkoutResult.customerName} ` : ''}
                        {checkoutResult.customerPhone ? `(+91 ${cleanPhone(checkoutResult.customerPhone)})` : ''}
                      </span>
                    </div>
                  )}

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
                    {checkoutResult.cashTendered && Number(checkoutResult.cashTendered) > 0 && (
                      <div className="flex justify-between text-muted-foreground pt-1 border-t border-dashed">
                        <span>Cash Tendered:</span>
                        <span className="font-semibold text-foreground">₹{Number(checkoutResult.cashTendered).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(checkoutResult.changeReturn || 0) > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                        <span>Change Return:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">₹{Number(checkoutResult.changeReturn).toFixed(2)}</span>
                      </div>
                    )}
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
      <div className={`flex-1 flex flex-col gap-3 min-w-0 md:h-full md:overflow-hidden ${cart.length > 0 ? 'pb-32' : 'pb-20'} md:pb-0`}>
        {/* Sticky Search & Actions Bar for Mobile & Desktop */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-md pt-0.5 pb-2 z-20">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input 
              ref={searchInputRef}
              placeholder="Search item / barcode..." 
              className="pl-10 pr-28 sm:pr-36 h-11 sm:h-12 md:h-14 text-sm md:text-base shadow-xs rounded-xl sm:rounded-2xl font-medium bg-background border-border/80"
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
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-1.5">
              <Button
                variant="outline"
                size="icon"
                title="Scan Parchi (List)"
                className="rounded-lg sm:rounded-xl shadow-2xs hover:border-blue-500/50 text-blue-600 bg-blue-50/80 dark:bg-blue-900/20 dark:text-blue-400 h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => setShowParchiModal(true)}
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="icon"
                title="Barcode Scanner (Staff Mode)"
                className="rounded-lg sm:rounded-xl shadow-xs text-white bg-emerald-600 hover:bg-emerald-700 h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => setShowScanner(true)}
              >
                <Barcode className="h-4 w-4" />
              </Button>
              {voiceSupported && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-lg sm:rounded-xl transition-all h-8 w-8 sm:h-9 sm:w-9 relative ${
                    isListening 
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse' 
                      : 'text-muted-foreground hover:text-primary hover:bg-muted'
                  }`}
                  onClick={handleVoiceSearch}
                  title="Voice Billing"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Category Tabs & WhatsApp Bot Live Indicator */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-hide flex-nowrap touch-pan-x shrink-0">
          <div className="flex gap-1.5 sm:gap-2 shrink-0">
            <Button 
              variant={activeTab === 'all' ? 'default' : 'outline'} 
              className="rounded-xl px-3 sm:px-4 h-8 text-xs font-semibold whitespace-nowrap"
              onClick={() => setActiveTab('all')}
            >
              All Items ({products.length})
            </Button>
            <Button 
              variant={activeTab === 'loose' ? 'default' : 'outline'} 
              className="rounded-xl px-3 sm:px-4 h-8 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5"
              onClick={() => setActiveTab('loose')}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Loose Items
            </Button>
            <Button 
              variant={activeTab === 'barcoded' ? 'default' : 'outline'} 
              className="rounded-xl px-3 sm:px-4 h-8 text-xs font-semibold whitespace-nowrap"
              onClick={() => setActiveTab('barcoded')}
            >
              Barcoded
            </Button>

            {/* D-Mart Rate Toggle */}
            <Button
              variant={pricingMode === 'wholesale' ? 'default' : 'outline'}
              size="sm"
              onClick={togglePricingMode}
              className={`h-8 text-xs font-bold rounded-xl px-2.5 whitespace-nowrap transition-all ${
                pricingMode === 'wholesale' 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs' 
                  : 'text-purple-600 border-purple-300 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40'
              }`}
              title="Switch between Retail and Wholesale pricing"
            >
              <BadgePercent className="h-3.5 w-3.5 mr-1" />
              {pricingMode === 'wholesale' ? '📦 Wholesale Pricing' : '🛍️ Retail Pricing'}
            </Button>

            {/* D-Mart Sales Return */}
            <Button
              variant="outline"
              size="sm"
              onClick={openReturnModal}
              className="h-8 text-xs font-semibold rounded-xl px-2.5 whitespace-nowrap hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Sales Return & Defective Exchange"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1 text-orange-500" />
              Return / Exchange
            </Button>

            {/* D-Mart Shift Register */}
            <Button
              variant="outline"
              size="sm"
              onClick={openShiftCloseModal}
              className="h-8 text-xs font-semibold rounded-xl px-2.5 whitespace-nowrap hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Cash Counter Shift Closing Register (Z-Report)"
            >
              <Calculator className="h-3.5 w-3.5 mr-1 text-emerald-600" />
              Shift Register
            </Button>
          </div>

          <div className="shrink-0 hidden sm:block">
            {liveWaStatus === 'CONNECTED' || liveWaStatus === 'AUTHENTICATED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-950/80 dark:text-green-300 border border-green-300 dark:border-green-800 shadow-2xs" title="Auto WhatsApp Bot is active.">
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
          <div className="bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300/40 dark:border-amber-800/40 rounded-xl p-2.5 shadow-2xs shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 dark:text-amber-200">
                <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>⚡ Quick Items (1-Click):</span>
              </div>
              <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                {looseQuickItems.length} items
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-nowrap touch-pan-x">
              {looseQuickItems.slice(0, 15).map(item => {
                const isOutOfStock = !Boolean((item as any).isLoose) && Number(item.stock ?? 0) <= 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (isOutOfStock) {
                        triggerStockAlert(`⚠️ "${item.name}" is out of stock! (Available: 0)`);
                        return;
                      }
                      addToCart(item);
                    }}
                    className={`shrink-0 flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 shadow-2xs transition-all active:scale-95 group text-left ${
                      isOutOfStock 
                        ? 'opacity-50 border-rose-300 bg-rose-50 dark:bg-rose-950/20 cursor-not-allowed' 
                        : 'bg-background hover:bg-amber-100/70 dark:hover:bg-amber-900/40 border-amber-200/80 dark:border-amber-800/80'
                    }`}
                    title={isOutOfStock ? 'Out of stock' : `Click to add or enter code ${(item as any).shortCode || item.barcode || ''}`}
                  >
                    {((item as any).shortCode) && (
                      <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded font-mono">
                        {(item as any).shortCode}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-foreground truncate max-w-[110px]">{item.name}</span>
                    <span className="text-xs font-bold text-primary shrink-0">₹{item.sellingPrice}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Clean, Compact Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 md:overflow-y-auto md:flex-1 md:min-h-0 pr-0.5 pb-28 md:pb-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.map(product => {
            const isLoose = Boolean((product as any).isLoose);
            const shortCode = (product as any).shortCode;
            const availableStock = Number(product.stock ?? 0);
            const isOutOfStock = !isLoose && availableStock <= 0;
            const isLowStock = !isLoose && !isOutOfStock && availableStock <= (product.minStock || 5);
            
            return (
              <div 
                key={product.id} 
                className={`group relative border rounded-2xl p-3 sm:p-3.5 transition-all duration-200 bg-card text-card-foreground flex flex-col justify-between ${
                  isOutOfStock 
                    ? 'opacity-65 border-rose-300/70 dark:border-rose-900/40 bg-rose-500/5 cursor-not-allowed' 
                    : 'cursor-pointer hover:border-primary/60 hover:shadow-md active:scale-[0.98] border-border/80'
                }`}
                onClick={() => {
                  if (isOutOfStock) {
                    triggerStockAlert(`⚠️ "${product.name}" is out of stock! (Available: 0)`);
                    return;
                  }
                  addToCart(product);
                }}
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

                  {isOutOfStock ? (
                    <span className="text-[10px] font-black text-rose-600 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-300/50">
                      Out of Stock (0)
                    </span>
                  ) : isLowStock ? (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 rounded-md">
                      Only {availableStock} {product.unit || 'pcs'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground ml-auto">
                      {product.stock} {product.unit || 'pcs'}
                    </span>
                  )}
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
                    disabled={isOutOfStock}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                      isOutOfStock 
                        ? 'bg-rose-100 text-rose-400 dark:bg-rose-950/40 cursor-not-allowed' 
                        : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                    }`}
                    title={isOutOfStock ? 'Out of stock' : 'Add to Bill'}
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
        <div className="md:hidden fixed bottom-[60px] left-2 right-2 sm:left-4 sm:right-4 p-2.5 sm:p-3 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.25)] z-40 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide leading-tight">
                  {cart.reduce((s, i) => s + i.qty, 0)} Items
                </p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                  ₹{total.toFixed(2)}
                </p>
              </div>
            </div>
            <Button 
              className="h-11 px-5 text-sm font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-2 active:scale-95 transition-transform"
              onClick={() => setShowMobileCart(true)}
            >
              <span>View Bill</span>
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {cart.length}
              </span>
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
        fixed inset-0 z-[120] bg-background text-foreground flex flex-col
        md:static md:w-[380px] lg:w-[420px] md:bg-card md:text-card-foreground md:rounded-2xl md:border md:shadow-sm md:h-full md:overflow-hidden md:z-auto shrink-0
        transition-transform duration-300 ease-in-out
        ${showMobileCart ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
      `}>
        {/* Mobile Header for Cart Overlay */}
        <div className="md:hidden p-4 border-b border-border bg-card flex items-center justify-between shadow-xs">
          <h2 className="font-bold text-xl flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Current Bill ({cart.reduce((s, i) => s + i.qty, 0)})
          </h2>
          <div className="flex items-center gap-2">
            {lastBill && cart.length === 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCheckoutResult(lastBill)}
                className="text-xs h-8 border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1 font-semibold"
              >
                <Printer className="h-3.5 w-3.5" /> Last Bill
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setShowMobileCart(false)} className="rounded-full bg-muted">
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex p-4 border-b bg-muted/30 rounded-t-xl items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Current Bill
          </h2>
          <div className="flex items-center gap-2">
            {lastBill && cart.length === 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCheckoutResult(lastBill)}
                className="text-xs h-8 border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1.5 font-semibold"
                title="Reprint previous bill"
              >
                <Printer className="h-3.5 w-3.5" /> Reprint Last Bill
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setCart([])} disabled={cart.length === 0}>
              Clear
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 py-12">
              <ShoppingCart className="h-12 w-12 opacity-20" />
              <p>Cart is empty</p>
              <p className="text-xs">Scan a barcode to add products</p>
              {lastBill && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCheckoutResult(lastBill)}
                  className="mt-2 text-xs font-semibold text-primary border-primary/40 hover:bg-primary/10 flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5" /> Reprint Last Bill (#{String(lastBill.id || '').slice(-6).toUpperCase()})
                </Button>
              )}
              <Button variant="outline" className="mt-4 md:hidden" onClick={() => setShowMobileCart(false)}>
                Go Back to Products
              </Button>
            </div>
          ) : (
            cart.map(item => {
              const isLoose = Boolean((item as any).isLoose);
              const maxStock = Number(item.stock ?? 999999);
              const isMaxStockReached = !isLoose && item.qty >= maxStock;

              return (
                <div key={item.id} className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-sm leading-tight text-foreground">{item.name}</p>
                    <p className="text-muted-foreground text-xs mt-1">₹{item.sellingPrice} x {item.qty}</p>
                    {isMaxStockReached && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                        ⚠️ Stock Limit: {maxStock}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-bold text-sm text-foreground">₹{((item.sellingPrice || 0) * item.qty).toFixed(2)}</p>
                    <div className="flex items-center gap-1 bg-muted rounded-xl p-1 border border-border/40">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg active:scale-90" onClick={() => updateQty(item.id, -1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-7 text-center text-sm font-bold">{item.qty}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled={isMaxStockReached}
                        className={`h-8 w-8 rounded-lg active:scale-90 ${
                          isMaxStockReached 
                            ? 'opacity-35 cursor-not-allowed text-muted-foreground' 
                            : 'text-primary hover:bg-primary/10'
                        }`} 
                        onClick={() => updateQty(item.id, 1)}
                        title={isMaxStockReached ? `Only ${maxStock} in stock` : 'Add 1 more'}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 active:scale-90" onClick={() => removeItem(item.id)}>
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-border bg-card md:bg-muted/10 md:rounded-b-xl space-y-3 shrink-0 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:shadow-none">
          {/* Customer Details Box: Name + Phone with Instant Auto-suggest */}
          {selectedCustomer ? (
            <div className="flex flex-col gap-1.5 pb-2.5 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Selected Customer
                </span>
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-0.5"
                  title="Change or remove customer"
                >
                  <X className="h-3 w-3" /> Change
                </button>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-emerald-950 dark:text-emerald-100 leading-tight">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-mono">
                    +91 {cleanPhone(selectedCustomer.phone)}
                  </p>
                </div>
                <div className="text-right">
                  {Number(selectedCustomer.balance || 0) > 0 ? (
                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/70 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800 block">
                      Udhar Due: ₹{Number(selectedCustomer.balance).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md block">
                      Balance Clear (₹0)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div ref={customerDropdownRef} className="relative flex flex-col gap-2 p-3 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  Customer Details (Name or Mobile)
                </span>
                {customerPhone ? (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${customerPhone.length === 10 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600'}`}>
                    {customerPhone.length}/10
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-medium">Optional</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Customer Name */}
                <div className="relative">
                  <Input 
                    placeholder="Customer Name (e.g. Rahul)"
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setShowCustomerSuggestions(true);
                    }}
                    onFocus={() => setShowCustomerSuggestions(true)}
                    className="h-10 text-xs sm:text-sm bg-white text-zinc-950 font-medium border-2 border-zinc-300 dark:border-zinc-400 focus:border-primary shadow-xs rounded-xl placeholder:text-zinc-400"
                  />
                </div>

                {/* Customer Mobile */}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 select-none">
                    +91
                  </span>
                  <Input 
                    placeholder="10-digit Mobile"
                    type="tel"
                    maxLength={10}
                    value={customerPhone}
                    onChange={(e) => {
                      const val = cleanPhone(e.target.value);
                      setCustomerPhone(val);
                      setShowCustomerSuggestions(true);
                    }}
                    onFocus={() => setShowCustomerSuggestions(true)}
                    className="h-10 pl-8 text-xs sm:text-sm bg-white text-zinc-950 font-bold border-2 border-zinc-300 dark:border-zinc-400 focus:border-primary shadow-xs rounded-xl font-mono tracking-wider placeholder:text-zinc-400"
                  />
                </div>
              </div>

              {/* Suggestions Dropdown */}
              {showCustomerSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 z-50 mb-1.5 bg-card text-card-foreground border-2 border-primary/40 rounded-2xl shadow-2xl overflow-hidden divide-y divide-border max-h-56 overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 bg-primary/10 text-[10px] font-black text-primary uppercase tracking-wider flex justify-between items-center">
                    <span>Registered Customers ({customerSuggestions.length})</span>
                    <span className="text-[9px] lowercase font-semibold">Click to select</span>
                  </div>
                  {customerSuggestions.map((cust) => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => handleSelectCustomer(cust)}
                      className="w-full px-3 py-2 text-left hover:bg-primary/5 flex items-center justify-between transition-colors group cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-xs text-foreground group-hover:text-primary flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-primary" />
                          {cust.name}
                        </p>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          +91 {cleanPhone(cust.phone)}
                        </p>
                      </div>
                      <div className="text-right">
                        {Number(cust.balance || 0) > 0 ? (
                          <span className="text-[10px] font-black text-rose-700 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-md border border-rose-300">
                            Udhar: ₹{Number(cust.balance).toFixed(0)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                            Clear (₹0)
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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

          {/* Quick Cash Given & Change Helper right in Cart */}
          {cart.length > 0 && total > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-emerald-600" /> Cash Tendered:
                </span>
                {parseFloat(cartCashReceived) > 0 && parseFloat(cartCashReceived) >= total && (
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-200/80 dark:bg-emerald-900/80 px-2 py-0.5 rounded-md">
                    Change: ₹{(parseFloat(cartCashReceived) - total).toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">₹</span>
                  <Input
                    type="number"
                    placeholder={`e.g. ${quickCashSuggestions[0] || 3000}`}
                    value={cartCashReceived}
                    onChange={(e) => setCartCashReceived(e.target.value)}
                    className="h-8 pl-6 text-xs font-black bg-white text-zinc-950 border-emerald-300 dark:border-emerald-700"
                  />
                </div>
                {quickCashSuggestions.slice(0, 2).map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCartCashReceived(amt.toString())}
                    className="text-[10px] font-bold px-2 h-8 rounded-lg bg-white dark:bg-card border border-emerald-400/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button 
              className="w-full h-13 text-base font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl active:scale-98 transition-transform" 
              disabled={cart.length === 0 || checkoutLoading}
              onClick={() => {
                setSplitAmounts({ cash: total, upi: 0, udhar: 0 });
                setCashTendered(cartCashReceived || '');
                setShowPaymentModal(true);
              }}
            >
              {checkoutLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <IndianRupee className="mr-2 h-5 w-5" />
              )}
              {parseFloat(cartCashReceived) >= total 
                ? `Pay & Return ₹${(parseFloat(cartCashReceived) - total).toFixed(0)} Change ↵` 
                : `Pay ₹${total.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-[150] flex flex-col justify-end sm:items-center sm:justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-0 sm:p-4">
          <div className="bg-card text-card-foreground p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl border shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-black text-foreground">Payment Options</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Split across Cash, UPI, or Credit (Udhar)</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowPaymentModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Total Bill Banner & 1-Click Presets */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-2xl shadow-md space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-blue-100 uppercase tracking-wider block">Total Bill Amount</span>
                  <span className="text-2xl font-black">₹{total.toFixed(2)}</span>
                </div>
                {/* 1-Click Quick Presets */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/20">
                  <button
                    type="button"
                    onClick={() => {
                      setSplitAmounts({ cash: total, upi: 0, udhar: 0 });
                      setCashTendered(cartCashReceived || '');
                    }}
                    className="text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white py-1.5 px-1 rounded-xl transition-all text-center"
                  >
                    💵 All Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitAmounts({ cash: 0, upi: total, udhar: 0 });
                      setCashTendered('');
                    }}
                    className="text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white py-1.5 px-1 rounded-xl transition-all text-center"
                  >
                    📱 All UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitAmounts({ cash: 0, upi: 0, udhar: total });
                      setCashTendered('');
                    }}
                    className="text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white py-1.5 px-1 rounded-xl transition-all text-center"
                  >
                    📝 All Udhar
                  </button>
                </div>
              </div>

              {/* D-MART CASH RECEIVED & CHANGE RETURN CALCULATOR */}
              {(splitAmounts.cash > 0 || (splitAmounts.upi === 0 && splitAmounts.udhar === 0)) && (
                <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border-2 border-emerald-500/40 dark:border-emerald-700/50 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      <Coins className="h-4 w-4 text-emerald-600" />
                      <span>Cash Received / Tendered</span>
                    </div>
                    {(() => {
                      const tenderedNum = parseFloat(cashTendered) || splitAmounts.cash || 0;
                      const cashNeeded = splitAmounts.cash > 0 ? splitAmounts.cash : Math.max(0, total - splitAmounts.upi - splitAmounts.udhar);
                      const changeDue = Math.max(0, tenderedNum - cashNeeded);
                      return changeDue > 0 ? (
                        <span className="text-[11px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-xs">
                          Change: ₹{changeDue.toFixed(2)}
                        </span>
                      ) : null;
                    })()}
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-zinc-500">₹</span>
                      <Input
                        type="number"
                        placeholder={`e.g. ${quickCashSuggestions[0] || total}`}
                        value={cashTendered || (splitAmounts.cash > total ? splitAmounts.cash.toString() : '')}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          setCashTendered(valStr);
                          const val = parseFloat(valStr) || 0;
                          if (val > 0) {
                            const maxNeeded = Math.max(0, total - splitAmounts.upi - splitAmounts.udhar);
                            setSplitAmounts(p => ({ ...p, cash: Math.min(val, maxNeeded) }));
                          }
                        }}
                        className="pl-7 h-11 text-lg font-black bg-white text-zinc-950 border-2 border-emerald-400 dark:border-emerald-600 rounded-xl shadow-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11 px-3 text-xs font-bold border-emerald-400 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                      onClick={() => {
                        const exact = Math.max(0, total - splitAmounts.upi - splitAmounts.udhar);
                        setCashTendered(exact.toString());
                        setSplitAmounts(p => ({ ...p, cash: exact }));
                      }}
                    >
                      Exact ₹{(total - splitAmounts.upi - splitAmounts.udhar).toFixed(0)}
                    </Button>
                  </div>

                  {/* Smart Quick Cash Chips based on bill total */}
                  {quickCashSuggestions.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-muted-foreground mr-0.5">Quick:</span>
                      {quickCashSuggestions.map((amt) => {
                        const tenderedNum = parseFloat(cashTendered) || 0;
                        const isSelected = tenderedNum === amt;
                        return (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setCashTendered(amt.toString());
                              const maxNeeded = Math.max(0, total - splitAmounts.upi - splitAmounts.udhar);
                              setSplitAmounts(p => ({ ...p, cash: maxNeeded }));
                            }}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-white dark:bg-card border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 text-foreground'
                            }`}
                          >
                            ₹{amt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Change Return Result Highlight Card */}
                  {(() => {
                    const tenderedNum = parseFloat(cashTendered) || (splitAmounts.cash > total ? splitAmounts.cash : 0);
                    const cashNeeded = Math.max(0, total - splitAmounts.upi - splitAmounts.udhar);
                    const changeDue = tenderedNum - cashNeeded;

                    if (tenderedNum >= cashNeeded && tenderedNum > 0) {
                      return (
                        <div className="p-3 bg-white dark:bg-card border-2 border-emerald-500 rounded-xl flex items-center justify-between shadow-xs">
                          <div>
                            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider block">
                              Change Due to Customer
                            </span>
                            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                              ₹{Math.max(0, changeDue).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground space-y-0.5">
                            <p>Tendered: <strong className="text-foreground">₹{tenderedNum.toFixed(2)}</strong></p>
                            <p>Bill: <strong className="text-foreground">₹{cashNeeded.toFixed(2)}</strong></p>
                          </div>
                        </div>
                      );
                    }
                    if (tenderedNum > 0 && changeDue < 0) {
                      return (
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold text-amber-900 dark:text-amber-200 flex justify-between items-center">
                          <span>Short Amount Remaining:</span>
                          <span className="text-rose-600 dark:text-rose-400 font-black">₹{Math.abs(changeDue).toFixed(2)}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
              
              {/* Customer Mobile & Name for WhatsApp & Udhar */}
              {selectedCustomer ? (
                <div className="flex flex-col gap-1.5 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      Customer: {selectedCustomer.name}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearCustomer}
                      className="text-[11px] font-semibold text-rose-500 hover:underline flex items-center gap-0.5"
                    >
                      <X className="h-3 w-3" /> Change
                    </button>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-emerald-700 dark:text-emerald-300">
                      +91 {cleanPhone(selectedCustomer.phone)}
                    </span>
                    {Number(selectedCustomer.balance || 0) > 0 ? (
                      <span className="font-bold text-rose-600">
                        Previous Udhar: ₹{Number(selectedCustomer.balance).toFixed(2)}
                      </span>
                    ) : (
                      <span className="font-medium text-emerald-600">All Cleared</span>
                    )}
                  </div>
                </div>
              ) : (
                <div ref={modalCustomerDropdownRef} className="relative flex flex-col gap-2 bg-muted/40 p-3 rounded-2xl border border-border">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-foreground">
                      Customer Details {splitAmounts.udhar > 0 ? <span className="text-red-500 font-extrabold">* (Required for Udhar)</span> : '(Name & WhatsApp)'}
                    </Label>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${customerPhone.length === 10 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 font-bold' : 'text-muted-foreground'}`}>
                      {customerPhone.length}/10
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="text" 
                      placeholder="Customer Name (e.g. Rahul)"
                      value={customerName} 
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setShowCustomerSuggestions(true);
                      }}
                      onFocus={() => setShowCustomerSuggestions(true)}
                      className="h-10 text-xs sm:text-sm bg-white text-zinc-950 font-medium border-2 border-zinc-300 dark:border-zinc-400 rounded-xl placeholder:text-zinc-400"
                    />

                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 select-none">
                        +91
                      </span>
                      <Input 
                        type="tel" 
                        placeholder="10-digit Mobile"
                        maxLength={10}
                        value={customerPhone} 
                        onChange={(e) => {
                          const val = cleanPhone(e.target.value);
                          setCustomerPhone(val);
                          setShowCustomerSuggestions(true);
                        }}
                        onFocus={() => setShowCustomerSuggestions(true)}
                        className={`h-10 pl-8.5 font-mono text-xs sm:text-sm bg-white text-zinc-950 font-bold border-2 border-zinc-300 dark:border-zinc-400 rounded-xl placeholder:text-zinc-400 ${splitAmounts.udhar > 0 && !customerPhone ? 'border-red-500 ring-2 ring-red-500/20' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Modal suggestions dropdown */}
                  {showCustomerSuggestions && customerSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl overflow-hidden divide-y divide-border/60 max-h-48 overflow-y-auto animate-in fade-in duration-150">
                      {customerSuggestions.map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="w-full px-3 py-2 text-left hover:bg-muted/80 flex items-center justify-between transition-colors group cursor-pointer"
                        >
                          <div>
                            <p className="font-bold text-xs text-foreground group-hover:text-primary">
                              {cust.name}
                            </p>
                            <p className="text-[11px] font-mono text-muted-foreground">
                              +91 {cleanPhone(cust.phone)}
                            </p>
                          </div>
                          <div className="text-right">
                            {Number(cust.balance || 0) > 0 ? (
                              <span className="text-[10px] font-bold text-rose-600">
                                Udhar: ₹{Number(cust.balance).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-600">
                                Clear
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Auto remainder checkbox */}
              <div className="flex items-center justify-between p-2.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-800/60 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-bold text-amber-950 dark:text-amber-200">
                    Auto-allocate remaining balance to Udhar
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
                    title="Allocate remaining to cash"
                    onClick={() => {
                      const rem = Math.max(0, Number((total - splitAmounts.upi - splitAmounts.udhar).toFixed(2)));
                      setSplitAmounts(p => ({ ...p, cash: rem }));
                    }}
                  >
                    Balance
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
                    title="Allocate remaining to UPI"
                    onClick={() => {
                      const rem = Math.max(0, Number((total - splitAmounts.cash - splitAmounts.udhar).toFixed(2)));
                      setSplitAmounts(p => ({ ...p, upi: rem }));
                    }}
                  >
                    Balance
                  </Button>
                </div>

                {/* Udhar Input */}
                <div className="flex items-center gap-2">
                  <Label className="w-16 font-bold text-sm text-orange-600 dark:text-orange-400">Udhar:</Label>
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
                    title="Allocate remaining to Udhar"
                    onClick={() => {
                      const rem = Math.max(0, Number((total - splitAmounts.cash - splitAmounts.upi).toFixed(2)));
                      setSplitAmounts(p => ({ ...p, udhar: rem }));
                    }}
                  >
                    + Udhar
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
                        <span>Amount matches! ({splitAmounts.cash > 0 ? `₹${splitAmounts.cash} Cash ` : ''}{splitAmounts.upi > 0 ? `+ ₹${splitAmounts.upi} UPI ` : ''}{splitAmounts.udhar > 0 ? `+ ₹${splitAmounts.udhar} Udhar ` : ''}= ₹{total.toFixed(2)})</span>
                      </div>
                    );
                  }
                  if (diff > 0) {
                    return (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl space-y-2 text-xs">
                        <div className="flex justify-between items-center font-bold text-amber-950 dark:text-amber-200">
                          <span>Remaining Balance:</span>
                          <span className="text-base font-black text-red-600">₹{diff.toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1 h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => setSplitAmounts(p => ({ ...p, udhar: Number((p.udhar + diff).toFixed(2)) }))}
                          >
                            + Add ₹{diff.toFixed(2)} to Udhar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-bold border-amber-300"
                            onClick={() => setSplitAmounts(p => ({ ...p, upi: Number((p.upi + diff).toFixed(2)) }))}
                          >
                            + To UPI
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  const excessAmount = Math.abs(diff);
                  return (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-2xl flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                          Change Due to Customer
                        </span>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                          ₹{excessAmount.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground font-semibold">
                        <p>Tendered: <strong className="text-foreground">₹{currentSum.toFixed(2)}</strong></p>
                        <p>Bill: <strong className="text-foreground">₹{total.toFixed(2)}</strong></p>
                      </div>
                    </div>
                  );
                })()}

                {/* Udhar Customer Details */}
                {splitAmounts.udhar > 0 && (
                  <div className="pt-2 border-t border-dashed mt-2 space-y-3">
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
                      Udhar Customer Details
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
                className="w-2/3 h-12 text-base font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white shadow-lg"
                onClick={() => {
                  setShowPaymentModal(false);
                  let mainMethod: 'cash' | 'upi' | 'udhar' | 'split' = 'split';
                  
                  const tenderedNum = parseFloat(cashTendered) || 0;
                  const cashInputVal = splitAmounts.cash || 0;
                  const effectiveTendered = tenderedNum > 0 ? tenderedNum : (cashInputVal > 0 ? cashInputVal : total);
                  
                  const cashNeededForBill = Math.max(0, total - splitAmounts.upi - splitAmounts.udhar);
                  const actualCashPortion = Math.min(cashInputVal > 0 ? cashInputVal : total, cashNeededForBill);
                  
                  const actualSplit = {
                    cash: actualCashPortion,
                    upi: splitAmounts.upi,
                    udhar: splitAmounts.udhar
                  };
                  
                  const changeToReturn = Math.max(0, effectiveTendered - actualCashPortion);

                  if (Math.abs(actualCashPortion - total) < 0.01) mainMethod = 'cash';
                  else if (Math.abs(splitAmounts.upi - total) < 0.01) mainMethod = 'upi';
                  else if (Math.abs(splitAmounts.udhar - total) < 0.01) mainMethod = 'udhar';
                  
                  handleCheckout(mainMethod, actualSplit, effectiveTendered, changeToReturn);
                }}
                disabled={
                  checkoutLoading || 
                  (splitAmounts.udhar > 0 && !customerPhone) || 
                  (
                    Number((splitAmounts.cash + splitAmounts.upi + splitAmounts.udhar).toFixed(2)) < (total - 0.01) &&
                    (parseFloat(cashTendered) || 0) < (total - 0.01)
                  )
                }
              >
                {checkoutLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (() => {
                  const tenderedNum = parseFloat(cashTendered) || (splitAmounts.cash > total ? splitAmounts.cash : 0);
                  const cashNeeded = Math.max(0, total - splitAmounts.upi - splitAmounts.udhar);
                  const changeDue = tenderedNum - cashNeeded;
                  if (changeDue > 0) {
                    return `Complete Bill • Return ₹${changeDue.toFixed(0)} Change ↵`;
                  }
                  return `Complete Bill (₹${total.toFixed(2)})`;
                })()}
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
        const shopGst = shopData?.gstNumber || '';
        const formattedDate = new Date(checkoutResult.createdAt || Date.now()).toLocaleDateString('en-IN');
        const formattedTime = new Date(checkoutResult.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const paperWidth = (shopData as any)?.settings?.paperSize === '58mm' || (shopData as any)?.receiptPaperSize === '58mm' ? '58mm' : '80mm';
        const receiptCustomHeader = (shopData as any)?.settings?.receiptHeader || (shopData as any)?.receiptHeader;
        const receiptCustomFooter = (shopData as any)?.settings?.receiptFooter || (shopData as any)?.receiptFooter;

        return (
          <div 
            id="receipt-template" 
            className={`hidden print:block absolute left-0 top-0 bg-white text-black text-[12px] leading-[1.3] font-mono z-0 p-3 ${paperWidth === '58mm' ? 'w-[58mm]' : 'w-[80mm]'}`}
            style={{ width: paperWidth }}
          >
            {/* STORE HEADER */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              {receiptCustomHeader && (
                <p style={{ margin: '0 0 3px 0', fontSize: '11px', fontWeight: 'bold' }}>{receiptCustomHeader}</p>
              )}
              <h2 style={{ margin: '0 0 2px 0', fontSize: '18px', fontWeight: '900', letterSpacing: '0.5px' }}>
                {(shopData.shopName || shopData.name || 'KIRANA STORE').toUpperCase()}
              </h2>
              {shopData.address && (
                <p style={{ margin: '2px 0', fontSize: '11px', lineHeight: '1.2' }}>{shopData.address}</p>
              )}
              {shopData.phone && (
                <p style={{ margin: '2px 0', fontSize: '11px' }}>Ph: {shopData.phone}</p>
              )}
              {shopGst ? (
                <p style={{ margin: '3px 0', fontSize: '12px', fontWeight: 'bold' }}>
                  GSTIN: {shopGst}
                </p>
              ) : null}
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
              <span>ITEM (MRP & RATE)</span>
              <span>AMOUNT</span>
            </div>

            {/* ITEMS LIST */}
            <div style={{ marginBottom: '4px' }}>
              {receiptItems.map((item, idx) => {
                const sp = Number(item.sellingPrice || 0);
                const mrp = Number(item.mrp || 0);
                const qty = Number(item.qty || 1);
                const itemTotal = sp * qty;
                const hasDiscount = mrp > sp;
                const unitStr = item.unit ? ` (${item.unit})` : '';

                return (
                  <div key={item.id || idx} style={{ padding: '3px 0', borderBottom: '1px dotted #ddd' }}>
                    <div style={{ fontWeight: '600', fontSize: '11px', wordBreak: 'break-word', lineHeight: '1.2' }}>
                      {idx + 1}. {item.name}{unitStr}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginTop: '2px' }}>
                      <span style={{ color: '#333' }}>
                        {hasDiscount ? (
                          <>
                            <span style={{ color: '#666', marginRight: '6px' }}>
                              MRP: <span style={{ textDecoration: 'line-through' }}>₹{mrp.toFixed(2)}</span>
                            </span>
                            <span style={{ fontWeight: 'bold', color: '#000' }}>Rate: ₹{sp.toFixed(2)}</span>
                          </>
                        ) : (
                          <span style={{ fontWeight: 'bold' }}>Rate: ₹{sp.toFixed(2)}</span>
                        )}
                        <span style={{ marginLeft: '6px', color: '#555' }}>x {qty}</span>
                      </span>
                      <span style={{ fontWeight: 'bold', fontSize: '11px' }}>
                        ₹{itemTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

            {/* TOTAL ITEMS & SUMMARY */}
            <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Items / Qty:</span>
                <span>{totalItemsCount} items ({totalQtyCount} qty)</span>
              </div>

              {totalMrpValue > checkoutResult.total && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
                  <span>Total MRP:</span>
                  <span>₹{totalMrpValue.toFixed(2)}</span>
                </div>
              )}

              {billDiscountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                  <span>Special Discount:</span>
                  <span>-₹{billDiscountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ borderBottom: '1.5px solid #000', margin: '4px 0' }}></div>

            {/* NET GRAND TOTAL */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '15px', padding: '2px 0' }}>
              <span>NET TOTAL:</span>
              <span>₹{checkoutResult.total.toFixed(2)}</span>
            </div>

            {/* CASH TENDERED & CHANGE RETURN */}
            {checkoutResult.cashTendered && Number(checkoutResult.cashTendered) > 0 ? (
              <div style={{ fontSize: '11px', padding: '3px 0', borderTop: '1px dashed #666', marginTop: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash Tendered:</span>
                  <span>₹{Number(checkoutResult.cashTendered).toFixed(2)}</span>
                </div>
                {Number(checkoutResult.changeReturn || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>Change Return:</span>
                    <span>₹{Number(checkoutResult.changeReturn).toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ borderBottom: '1.5px solid #000', margin: '4px 0' }}></div>

            {/* SAVINGS - CLEAN & MINIMAL */}
            {grandTotalSavings > 0 && (
              <div style={{ 
                textAlign: 'center', 
                padding: '4px 0', 
                fontSize: '11px', 
                fontWeight: 'bold',
                borderBottom: '1px dashed #000'
              }}>
                ✨ You Saved: ₹{grandTotalSavings.toFixed(2)} ({savingsPercentage}% savings)
              </div>
            )}

            {/* UPI SCAN & PAY ON THERMAL RECEIPT */}
            {shopData?.upiId && (
              <div style={{ textAlign: 'center', margin: '6px 0 4px 0', padding: '4px', border: '1px dashed #000' }}>
                <p style={{ margin: '0 0 3px 0', fontSize: '10px', fontWeight: 'bold' }}>Scan & Pay via UPI</p>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=${shopData.upiId}&pn=${encodeURIComponent(shopData.shopName || shopData.name || 'Store')}&am=${checkoutResult.total}&cu=INR`)}`}
                  alt="UPI QR"
                  style={{ width: '70px', height: '70px', margin: '0 auto', display: 'block' }}
                />
                <p style={{ margin: '3px 0 0 0', fontSize: '9px', fontWeight: 'bold' }}>UPI: {shopData.upiId}</p>
              </div>
            )}

            {/* FOOTER */}
            <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '10px', lineHeight: '1.3' }}>
              {receiptCustomFooter && (
                <p style={{ margin: '2px 0 4px 0', fontWeight: 'bold' }}>{receiptCustomFooter}</p>
              )}
              <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Thank You For Shopping!</p>
              <p style={{ margin: '1px 0' }}>Please Visit Again 🙏</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#777' }}>Software by Nayashi Kirana POS</p>
            </div>
          </div>
        );
      })()}
      {/* D-MART SALES RETURN & EXCHANGE MODAL */}
      {showReturnModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-muted/40">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Sales Return & Exchange</h3>
                  <p className="text-xs text-muted-foreground">Return sold items, refund cash, or write off damaged goods.</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setShowReturnModal(false); setSelectedReturnTx(null); }} className="rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {!selectedReturnTx ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search bill by Invoice # or Customer Mobile..."
                      value={returnSearchTerm}
                      onChange={(e) => setReturnSearchTerm(e.target.value)}
                      className="pl-9 bg-white dark:bg-card"
                    />
                  </div>

                  {returnLoading ? (
                    <div className="py-12 flex justify-center text-primary">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="divide-y border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                      {returnAllTransactions
                        .filter(tx => {
                          const query = returnSearchTerm.toLowerCase();
                          return (
                            tx.id?.toLowerCase().includes(query) ||
                            tx.customerName?.toLowerCase().includes(query) ||
                            tx.customerPhone?.includes(query)
                          );
                        })
                        .slice(0, 15)
                        .map(tx => (
                          <div
                            key={tx.id}
                            onClick={() => setSelectedReturnTx(tx)}
                            className="p-3 hover:bg-muted/50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                          >
                            <div>
                              <p className="font-bold text-foreground">Invoice #{tx.id?.slice(0, 8).toUpperCase()}</p>
                              <p className="text-muted-foreground">
                                {new Date(tx.createdAt || tx.date).toLocaleDateString()} • {tx.customerName || 'Walk-in'} {tx.customerPhone ? `(${tx.customerPhone})` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-sm text-foreground">₹{Number(tx.total || 0).toFixed(2)}</p>
                              <span className="text-[10px] text-primary font-semibold">Select Bill →</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-muted/30 border rounded-xl p-3 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-foreground">Selected Bill: #{selectedReturnTx.id?.slice(0, 8).toUpperCase()}</p>
                      <p className="text-muted-foreground">
                        Customer: {selectedReturnTx.customerName || 'Walk-in'} • Total: ₹{Number(selectedReturnTx.total || 0).toFixed(2)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setSelectedReturnTx(null)} className="h-7 text-xs">
                      Change Bill
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-muted-foreground mb-1.5 block">Select Item to Return:</Label>
                    <div className="grid gap-2">
                      {((selectedReturnTx.items || []) as any[]).map((it: any, idx: number) => {
                        const isSelected = selectedReturnItem?.name === it.name;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedReturnItem({
                                id: it.productId || it.id,
                                name: it.name,
                                maxQty: it.qty || 1,
                                price: it.sellingPrice || it.price || 0
                              });
                              setReturnQty('1');
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                              isSelected ? 'border-primary bg-primary/5 font-bold' : 'border-border hover:bg-muted/30'
                            }`}
                          >
                            <div>
                              <p className="font-bold text-foreground">{it.name}</p>
                              <p className="text-muted-foreground">Sold Qty: {it.qty} • Rate: ₹{(it.sellingPrice || it.price || 0).toFixed(2)}</p>
                            </div>
                            <span className="font-black text-foreground">₹{((it.sellingPrice || it.price || 0) * (it.qty || 1)).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedReturnItem && (
                    <div className="border-t pt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Return Quantity (Max {selectedReturnItem.maxQty})</Label>
                          <Input
                            type="number"
                            min="1"
                            max={selectedReturnItem.maxQty}
                            value={returnQty}
                            onChange={(e) => setReturnQty(e.target.value)}
                            className="bg-white dark:bg-card font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Refund Amount</Label>
                          <div className="h-10 px-3 bg-muted rounded-md flex items-center font-black text-emerald-600 text-sm">
                            ₹{((parseFloat(returnQty) || 0) * selectedReturnItem.price).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Item Condition</Label>
                          <select
                            value={returnCondition}
                            onChange={(e) => setReturnCondition(e.target.value as any)}
                            className="w-full h-10 rounded-md border border-input bg-card px-3 text-xs"
                          >
                            <option value="resellable">🟢 Resellable (Restock Item)</option>
                            <option value="damaged">🔴 Damaged / Defective (Scrap & Write-off)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Refund Payment Method</Label>
                          <select
                            value={returnRefundMethod}
                            onChange={(e) => setReturnRefundMethod(e.target.value as any)}
                            className="w-full h-10 rounded-md border border-input bg-card px-3 text-xs"
                          >
                            <option value="cash">💵 Cash Refund</option>
                            <option value="udhar">📒 Add to Customer Credit (Udhar Balance)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Return Reason</Label>
                        <Input
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                          placeholder="e.g. Defective seal, Customer change of mind, Expired"
                          className="bg-white dark:bg-card text-xs"
                        />
                      </div>

                      <Button
                        onClick={handleProcessSalesReturn}
                        disabled={returnLoading}
                        className="w-full font-bold bg-primary text-primary-foreground shadow-md h-10 mt-2"
                      >
                        {returnLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Confirm Return & Process Refund
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* D-MART CASH COUNTER SHIFT CLOSE MODAL (Z-REPORT) */}
      {showShiftCloseModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-muted/40">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Cash Counter Shift Closing (Z-Report)</h3>
                  <p className="text-xs text-muted-foreground">Count physical drawer cash, verify against system sales, and close shift.</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowShiftCloseModal(false)} className="rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {shiftClosedSummary ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 rounded-full mx-auto flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h4 className="text-lg font-bold text-foreground">Shift Closed Successfully!</h4>
                  <p className="text-muted-foreground text-xs">
                    Shift Z-Report has been logged for cashier <strong>{shiftClosedSummary.cashierName}</strong>. Total physical cash collected: <strong>₹{shiftClosedSummary.actualCash.toFixed(2)}</strong>.
                  </p>
                  <Button onClick={() => setShowShiftCloseModal(false)} className="font-bold">
                    Close Window
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl border">
                    <div>
                      <Label className="text-[11px] font-bold text-muted-foreground">Opening Float / Drawer Cash</Label>
                      <Input
                        type="number"
                        value={openingCash}
                        onChange={(e) => setOpeningCash(e.target.value)}
                        placeholder="0"
                        className="bg-white dark:bg-card font-bold text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-bold text-muted-foreground">Total Counted Cash</Label>
                      <div className="h-10 px-3 bg-card border rounded-md flex items-center font-black text-emerald-600 text-base mt-1 shadow-2xs">
                        ₹{totalCountedCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-muted-foreground mb-2 block">Currency Denomination Breakdown:</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: '₹500 Notes', key: 'd500', value: 500 },
                        { label: '₹200 Notes', key: 'd200', value: 200 },
                        { label: '₹100 Notes', key: 'd100', value: 100 },
                        { label: '₹50 Notes', key: 'd50', value: 50 },
                        { label: '₹20 Notes', key: 'd20', value: 20 },
                        { label: '₹10 Notes', key: 'd10', value: 10 },
                      ].map((denom) => (
                        <div key={denom.key} className="flex items-center gap-2 border p-2 rounded-lg bg-card">
                          <span className="w-20 font-bold text-[11px]">{denom.label}:</span>
                          <Input
                            type="number"
                            min="0"
                            value={(denominations as any)[denom.key] || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setDenominations(prev => ({ ...prev, [denom.key]: val }));
                            }}
                            placeholder="0"
                            className="h-8 text-xs font-bold bg-white dark:bg-card text-center"
                          />
                          <span className="w-16 text-right font-semibold text-[11px] text-muted-foreground">
                            = ₹{(((denominations as any)[denom.key] || 0) * denom.value).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center gap-2 border p-2 rounded-lg bg-card">
                      <span className="w-32 font-bold text-[11px]">Coins & Loose Change:</span>
                      <Input
                        type="number"
                        min="0"
                        value={denominations.coins || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setDenominations(prev => ({ ...prev, coins: val }));
                        }}
                        placeholder="₹0"
                        className="h-8 text-xs font-bold bg-white dark:bg-card"
                      />
                    </div>
                  </div>
                      <Input
                        type="number"
                        min="0"
                        value={denominations.coins || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setDenominations(prev => ({ ...prev, coins: val }));
                        }}
                        placeholder="₹0"
                        className="h-8 text-xs font-bold bg-white dark:bg-card"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveShiftClose}
                    disabled={shiftClosingSaving}
                    className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md h-10 mt-2"
                  >
                    {shiftClosingSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                    Save Shift Close & Print Z-Report
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
