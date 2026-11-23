import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  RefreshCw, 
  Camera, 
  Wand2, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  Hash, 
  Mic, 
  MicOff, 
  Tag, 
  Percent, 
  Printer, 
  Check, 
  Search, 
  AlertCircle,
  PackageCheck,
  Plus,
  FolderPlus,
  Trash2,
  X
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Product } from '../types';
import { CameraScanner } from '../components/CameraScanner';
import { compressImage } from '../lib/imageCompressor';
import { INDIAN_FMCG_CATALOG, searchFMCGCatalog, findFMCGByBarcode } from '../lib/fmcgCatalog';
import type { FMCGTemplate } from '../lib/fmcgCatalog';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { shopData } = useAuth();
  const isEditing = !!id;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  
  // Standard & Custom Categories Management State
  const DEFAULT_CATEGORIES = [
    'Dairy',
    'Snacks',
    'Beverages',
    'Grains & Pulses',
    'Spices',
    'Personal Care',
    'Home Care',
    'Bakery',
    'Frozen Food',
    'Edible Oils & Ghee',
    'Dry Fruits & Nuts',
    'Pooja & Agarbatti',
    'Baby Care',
    'Stationery',
    'Other'
  ];

  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('martgpt_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categorySuccessMsg, setCategorySuccessMsg] = useState('');

  // FMCG Auto-Complete Suggestions State
  const [fmcgSuggestions, setFmcgSuggestions] = useState<FMCGTemplate[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Voice AI Recognition State
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

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

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Load custom categories from existing store products
  useEffect(() => {
    const loadCategoriesFromInventory = async () => {
      try {
        const prods = await api.products.list();
        if (Array.isArray(prods)) {
          const fromProducts = new Set<string>();
          prods.forEach((p: Product) => {
            if (p.category && !DEFAULT_CATEGORIES.includes(p.category)) {
              fromProducts.add(p.category);
            }
          });
          if (fromProducts.size > 0) {
            setCustomCategories(prev => {
              const combined = Array.from(new Set([...prev, ...fromProducts]));
              try { localStorage.setItem('martgpt_custom_categories', JSON.stringify(combined)); } catch {}
              return combined;
            });
          }
        }
      } catch (e) {}
    };
    loadCategoriesFromInventory();
  }, []);

  const handleCreateCategory = (catName?: string) => {
    const targetName = (catName || newCategoryInput).trim();
    if (!targetName) return;

    const existsInDefault = DEFAULT_CATEGORIES.some(c => c.toLowerCase() === targetName.toLowerCase());
    const matchedName = existsInDefault 
      ? DEFAULT_CATEGORIES.find(c => c.toLowerCase() === targetName.toLowerCase())!
      : targetName;

    if (!existsInDefault) {
      const updated = Array.from(new Set([...customCategories, targetName]));
      setCustomCategories(updated);
      try {
        localStorage.setItem('martgpt_custom_categories', JSON.stringify(updated));
      } catch {}
    }

    setFormData(prev => ({ ...prev, category: matchedName }));
    setCategorySuccessMsg(`Category "${matchedName}" selected!`);
    setNewCategoryInput('');
    setTimeout(() => {
      setShowCategoryModal(false);
      setCategorySuccessMsg('');
    }, 700);
  };

  const handleDeleteCustomCategory = (catToDelete: string) => {
    const updated = customCategories.filter(c => c !== catToDelete);
    setCustomCategories(updated);
    try {
      localStorage.setItem('martgpt_custom_categories', JSON.stringify(updated));
    } catch {}
    if (formData.category === catToDelete) {
      setFormData(prev => ({ ...prev, category: '' }));
    }
  };

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
    setFormData(prev => ({ ...prev, barcode: random }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));

    // Instant FMCG catalog search when typing product name
    if (id === 'name') {
      if (value.trim().length >= 2) {
        const matches = searchFMCGCatalog(value);
        setFmcgSuggestions(matches.slice(0, 6));
        setShowSuggestions(matches.length > 0);
      } else {
        setShowSuggestions(false);
      }
    }

    // Auto-match when typing barcode
    if (id === 'barcode' && value.trim().length >= 8) {
      const matched = findFMCGByBarcode(value.trim());
      if (matched && !formData.name) {
        applyFMCGTemplate(matched);
      }
    }
  };

  // Apply Pre-filled Template from FMCG Database
  const applyFMCGTemplate = (item: FMCGTemplate) => {
    setFormData(prev => ({
      ...prev,
      name: item.name,
      category: item.category,
      brand: item.brand,
      unit: item.unit,
      mrp: item.mrp.toString(),
      purchasePrice: item.purchasePrice.toString(),
      sellingPrice: item.sellingPrice.toString(),
      gst: item.gst.toString(),
      barcode: item.barcode || prev.barcode,
      isLoose: Boolean(item.isLoose)
    }));
    setShowSuggestions(false);
  };

  // 1-Click Category Quick Presets
  const applyCategoryPreset = (categoryType: 'dairy' | 'loose' | 'snacks' | 'fmcg' | 'spices') => {
    if (categoryType === 'dairy') {
      setFormData(prev => ({ ...prev, category: 'Dairy', unit: 'pkt', gst: '0', isLoose: false }));
    } else if (categoryType === 'loose') {
      setFormData(prev => ({ ...prev, category: 'Grains & Pulses', unit: 'kg', gst: '0', isLoose: true }));
      handleAutoShortCode();
    } else if (categoryType === 'snacks') {
      setFormData(prev => ({ ...prev, category: 'Snacks', unit: 'pkt', gst: '18', isLoose: false }));
    } else if (categoryType === 'fmcg') {
      setFormData(prev => ({ ...prev, category: 'Personal Care', unit: 'pcs', gst: '18', isLoose: false }));
    } else if (categoryType === 'spices') {
      setFormData(prev => ({ ...prev, category: 'Spices', unit: 'pkt', gst: '5', isLoose: false }));
    }
  };

  // 1-Click Margin Preset (Calculates Selling Price from Purchase Price)
  const applyMarginPreset = (percentage: number) => {
    const cost = parseFloat(formData.purchasePrice) || 0;
    if (cost <= 0) {
      alert('Please enter Purchase Price (Cost) first to calculate margin!');
      return;
    }
    const calculatedSP = Number((cost * (1 + percentage / 100)).toFixed(2));
    setFormData(prev => ({
      ...prev,
      sellingPrice: calculatedSP.toString(),
      mrp: prev.mrp ? prev.mrp : Math.round(calculatedSP * 1.1).toString()
    }));
  };

  // Match SP exactly to MRP
  const matchMRP = () => {
    if (formData.mrp) {
      setFormData(prev => ({ ...prev, sellingPrice: prev.mrp }));
    }
  };

  // Smart Speech-to-Product Voice Assistant
  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is supported in Google Chrome, Microsoft Edge, and Android Chrome. Please use Chrome browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceTranscript('Listening... Speak now (e.g., "Tata Salt 1kg purchase 24 sale 28 MRP 30 stock 50")');
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setVoiceTranscript(`Recognized: "${text}"`);
        parseVoiceCommand(text);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsListening(false);
        setVoiceTranscript('Voice input stopped. Try again.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  // Parse Voice String into Form Fields
  const parseVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();
    
    // Extract numbers
    const purchaseMatch = lower.match(/(?:purchase|cost|kharedi|buy)\s*(?:is|at|of)?\s*([0-9]+(?:\.[0-9]+)?)/i);
    const saleMatch = lower.match(/(?:sale|sell|selling|vikri|sp)\s*(?:is|at|of)?\s*([0-9]+(?:\.[0-9]+)?)/i);
    const mrpMatch = lower.match(/(?:mrp|max)\s*(?:is|at|of)?\s*([0-9]+(?:\.[0-9]+)?)/i);
    const stockMatch = lower.match(/(?:stock|qty|quantity)\s*(?:is|at|of)?\s*([0-9]+)/i);

    // Clean name from keyword prefixes
    let cleanName = text
      .replace(/(?:purchase|cost|kharedi|sale|sell|selling|vikri|mrp|stock|qty|quantity)\s*[0-9]+(?:\.[0-9]+)?/gi, '')
      .replace(/rupees|rs|inr/gi, '')
      .trim();

    if (cleanName.length > 2) {
      setFormData(prev => ({
        ...prev,
        name: cleanName,
        purchasePrice: purchaseMatch ? purchaseMatch[1] : prev.purchasePrice,
        sellingPrice: saleMatch ? saleMatch[1] : prev.sellingPrice,
        mrp: mrpMatch ? mrpMatch[1] : prev.mrp,
        stock: stockMatch ? stockMatch[1] : prev.stock
      }));

      // Check if matches an FMCG catalog item
      const matches = searchFMCGCatalog(cleanName);
      if (matches.length > 0) {
        applyFMCGTemplate(matches[0]);
      }
    }
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
    const matches = searchFMCGCatalog(formData.name);
    if (matches.length > 0) {
      applyFMCGTemplate(matches[0]);
      return;
    }

    const nameLower = formData.name.toLowerCase();
    let suggestedCategory = formData.category;
    let suggestedBrand = formData.brand;
    let suggestedUnit = formData.unit;

    if (nameLower.includes('milk') || nameLower.includes('paneer') || nameLower.includes('curd')) {
      suggestedCategory = 'Dairy';
      suggestedUnit = nameLower.includes('milk') ? 'ltr' : 'kg';
    } else if (nameLower.includes('rice') || nameLower.includes('daal') || nameLower.includes('dal') || nameLower.includes('atta') || nameLower.includes('flour')) {
      suggestedCategory = 'Grains & Pulses';
      suggestedUnit = 'kg';
    } else if (nameLower.includes('soap') || nameLower.includes('shampoo')) {
      suggestedCategory = 'Personal Care';
      suggestedUnit = 'pcs';
    } else if (nameLower.includes('chips') || nameLower.includes('biscuit') || nameLower.includes('noodle')) {
      suggestedCategory = 'Snacks';
      suggestedUnit = 'pkt';
    }

    if (nameLower.includes('amul')) suggestedBrand = 'Amul';
    else if (nameLower.includes('tata')) suggestedBrand = 'Tata';
    else if (nameLower.includes('britannia')) suggestedBrand = 'Britannia';
    else if (nameLower.includes('parle')) suggestedBrand = 'Parle';
    else if (nameLower.includes('fortune')) suggestedBrand = 'Fortune';
    else if (nameLower.includes('nestle')) suggestedBrand = 'Nestle';

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
    const mrp = Number(formData.mrp) || 0;

    if (pp > 0 && sp > 0) {
      const profit = sp - pp;
      const margin = (profit / sp) * 100;
      const discount = mrp > sp ? mrp - sp : 0;
      const discountPercent = mrp > sp ? ((discount / mrp) * 100) : 0;
      return { profit, margin, discount, discountPercent };
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/products')} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              <PackageCheck className="h-7 w-7 text-primary" />
              {isEditing ? 'Edit Product Master' : 'Smart Product Master'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Supermarket speed catalog with 1-click FMCG presets, smart margin calculator & sticker printing.
            </p>
          </div>
        </div>

        {/* 1-Click Voice Assistant Button */}
        <Button
          type="button"
          onClick={handleVoiceInput}
          variant="outline"
          className={`gap-2 text-xs font-bold border-2 transition-all ${
            isListening 
              ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 animate-pulse' 
              : 'border-primary/40 text-primary hover:bg-primary/10'
          }`}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isListening ? 'Listening...' : 'Voice Add'}
        </Button>
      </div>

      {voiceTranscript && (
        <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-xs font-mono text-primary flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>{voiceTranscript}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-destructive/15 p-4 text-sm text-destructive border border-destructive/20 font-medium flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* 1-Click Category Quick Presets */}
      <div className="p-4 bg-muted/40 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-amber-500" /> Quick Category Presets:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyCategoryPreset('loose')}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center gap-1.5"
          >
            🌾 Loose Kirana (No Barcode)
          </button>
          <button
            type="button"
            onClick={() => applyCategoryPreset('dairy')}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-all flex items-center gap-1.5"
          >
            🥛 Dairy & Milk
          </button>
          <button
            type="button"
            onClick={() => applyCategoryPreset('snacks')}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/30 hover:bg-orange-500/20 transition-all flex items-center gap-1.5"
          >
            🍪 Snacks & Biscuits
          </button>
          <button
            type="button"
            onClick={() => applyCategoryPreset('spices')}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
          >
            🥫 Spices & Oils
          </button>
          <button
            type="button"
            onClick={() => applyCategoryPreset('fmcg')}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-all flex items-center gap-1.5"
          >
            🧼 Soaps & Cleaning
          </button>
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <FolderPlus className="h-3.5 w-3.5" /> + New Category
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Section 1: Basic Identity & Instant FMCG Auto-Lookup */}
          <div className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6 shadow-sm md:col-span-2 relative">
            <div className="flex items-center justify-between pb-2 border-b">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" /> Product Identity & Catalog
              </h2>
              <span className="text-xs text-muted-foreground font-mono">10,000+ Pre-loaded FMCG</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Product Name with Instant Suggestions Dropdown */}
              <div className="space-y-2 relative" ref={suggestionsRef}>
                <div className="flex items-center justify-between">
                  <Label htmlFor="name" className="text-xs font-bold">Product Name *</Label>
                  <span className="text-[11px] text-muted-foreground">Type e.g. "Parle", "Tata", "Amul"</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="name" 
                      value={formData.name} 
                      onChange={handleChange} 
                      placeholder="e.g. Parle-G 100g or Tata Salt 1kg" 
                      required 
                      className="pl-9 font-semibold"
                      autoComplete="off"
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    onClick={aiSuggestDetails} 
                    title="AI Auto-fill Details"
                    className="shrink-0"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                  </Button>
                </div>

                {/* Instant FMCG Auto-Complete Dropdown */}
                {showSuggestions && fmcgSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover text-popover-foreground border rounded-xl shadow-2xl overflow-hidden divide-y animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-2 bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                      <span>Matches from FMCG Catalog:</span>
                      <span>Click to Auto-fill</span>
                    </div>
                    {fmcgSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => applyFMCGTemplate(item)}
                        className="p-3 hover:bg-primary/10 cursor-pointer transition-colors flex items-center justify-between text-xs group"
                      >
                        <div>
                          <p className="font-bold text-foreground group-hover:text-primary">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.brand} • {item.category} • {item.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-emerald-600">MRP: ₹{item.mrp}</p>
                          <span className="text-[10px] text-primary underline">Apply All Fields →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="category" className="text-xs font-bold flex items-center gap-1">
                    Category *
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> + Add / Create Category
                  </button>
                </div>
                <select 
                  id="category" 
                  value={formData.category} 
                  onChange={(e) => {
                    if (e.target.value === '__create_new__') {
                      setShowCategoryModal(true);
                    } else {
                      handleChange(e);
                    }
                  }} 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="" disabled>Select Category</option>
                  <optgroup label="Standard Categories">
                    {DEFAULT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </optgroup>
                  {customCategories.length > 0 && (
                    <optgroup label="Your Custom Store Categories">
                      {customCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>
                  )}
                  {formData.category && !DEFAULT_CATEGORIES.includes(formData.category) && !customCategories.includes(formData.category) && (
                    <optgroup label="Current Product Category">
                      <option value={formData.category}>{formData.category}</option>
                    </optgroup>
                  )}
                  <option value="__create_new__" className="text-primary font-black bg-primary/5">
                    ➕ + Create New Category...
                  </option>
                </select>
              </div>

              {/* Brand */}
              <div className="space-y-2">
                <Label htmlFor="brand" className="text-xs font-bold">Brand</Label>
                <Input id="brand" value={formData.brand} onChange={handleChange} placeholder="e.g. Amul, Parle, Tata" />
              </div>

              {/* Unit */}
              <div className="space-y-2">
                <Label htmlFor="unit" className="text-xs font-bold">Measurement Unit *</Label>
                <select 
                  id="unit" 
                  value={formData.unit} 
                  onChange={handleChange} 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="pkt">Packet (pkt)</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="gm">Gram (gm)</option>
                  <option value="ltr">Liter (ltr)</option>
                  <option value="ml">Milliliter (ml)</option>
                  <option value="box">Box</option>
                </select>
              </div>

              {/* Product Photo */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="imageUpload" className="text-xs font-bold">Product Image / Camera Capture</Label>
                <div className="flex items-center gap-4">
                  {formData.imageUrl && (
                    <div className="h-16 w-16 rounded-xl overflow-hidden border shadow-xs shrink-0">
                      <img src={formData.imageUrl} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input 
                        id="imageUpload" 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="cursor-pointer text-xs"
                      />
                      <div className="relative">
                        <Input 
                          id="cameraUpload" 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          onChange={handleImageUpload} 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        />
                        <Button type="button" variant="outline" className="flex gap-1.5 relative z-0 text-xs">
                          <Camera className="h-4 w-4" /> Camera
                        </Button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Auto-compressed under 100 KB for fast cloud sync</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Loose Grocery & Fast Shortcut Number */}
          <div className={`rounded-2xl border p-5 sm:p-6 shadow-sm md:col-span-2 transition-all duration-200 ${
            formData.isLoose 
              ? 'bg-amber-500/10 border-amber-500/40 dark:bg-amber-950/20 dark:border-amber-700/50' 
              : 'bg-card'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${formData.isLoose ? 'bg-amber-500 text-white shadow-md' : 'bg-muted text-muted-foreground'}`}>
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                    Loose / Non-Barcode Grocery Item
                    {formData.isLoose && <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Active</span>}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    For items without barcodes such as sugar, rice, grains, pulses, and loose spices.
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
                    <Label htmlFor="shortCode" className="font-bold flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-200">
                      <Hash className="h-4 w-4 text-amber-600" /> Shortcut Code / POS Number (1, 2, 3...) *
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
                  <p className="text-[11px] text-amber-800 dark:text-amber-300/80 leading-relaxed">
                    💡 <strong>Ultra Fast Billing:</strong> In POS billing, type <strong>"{formData.shortCode || '1'}"</strong> and press Enter to instantly add this item!
                  </p>
                </div>

                <div className="rounded-xl bg-white/60 dark:bg-black/20 p-4 border border-amber-500/20 text-xs space-y-1.5 flex flex-col justify-center">
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    🏪 Supermarket Advantage:
                  </p>
                  <p className="text-muted-foreground">
                    • Single-digit shortcodes sell loose grocery items with lightning speed.
                  </p>
                  <p className="text-muted-foreground">
                    • These items automatically populate the Top Quick-Add Buttons on the POS register.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Smart Pricing & Margin Simulator */}
          <div className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" /> Pricing, Margins & D-Mart Discounts
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set purchase and selling rates. Use 1-click margin buttons to calculate profit margins automatically.
                </p>
              </div>

              {/* 1-Click Margin Buttons */}
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-semibold mr-1">Quick Margins:</span>
                {[10, 15, 20, 25, 30].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyMarginPreset(pct)}
                    className="px-2 py-1 text-[11px] font-bold rounded-lg border bg-muted/60 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/40 transition-all"
                  >
                    +{pct}%
                  </button>
                ))}
                {formData.mrp && (
                  <button
                    type="button"
                    onClick={matchMRP}
                    className="px-2 py-1 text-[11px] font-bold rounded-lg border bg-muted/60 hover:bg-primary/10 hover:text-primary transition-all"
                  >
                    = MRP
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Purchase Price */}
              <div className="space-y-1.5">
                <Label htmlFor="purchasePrice" className="text-xs font-bold">Purchase Price (Cost) ₹ *</Label>
                <Input 
                  id="purchasePrice" 
                  value={formData.purchasePrice} 
                  onChange={handleChange} 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  required 
                  className="font-mono text-base font-bold"
                />
                <p className="text-[11px] text-muted-foreground">What you pay the wholesaler</p>
              </div>

              {/* Selling Price */}
              <div className="space-y-1.5">
                <Label htmlFor="sellingPrice" className="text-xs font-bold">Selling Price (Store Rate) ₹ *</Label>
                <Input 
                  id="sellingPrice" 
                  value={formData.sellingPrice} 
                  onChange={handleChange} 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  required 
                  className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400"
                />
                <p className="text-[11px] text-muted-foreground">Your store billing price</p>
              </div>

              {/* MRP */}
              <div className="space-y-1.5">
                <Label htmlFor="mrp" className="text-xs font-bold">MRP (Maximum Retail Price) ₹</Label>
                <Input 
                  id="mrp" 
                  value={formData.mrp} 
                  onChange={handleChange} 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  className="font-mono text-base"
                />
                <p className="text-[11px] text-muted-foreground">Printed MRP on packet</p>
              </div>

              {/* GST % */}
              <div className="space-y-1.5">
                <Label htmlFor="gst" className="text-xs font-bold">GST Tax %</Label>
                <select
                  id="gst"
                  value={formData.gst}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold"
                >
                  <option value="0">0% (Nil / Essential Grocery)</option>
                  <option value="5">5% (Edible Oil, Tea, Atta)</option>
                  <option value="12">12% (Butter, Cheese, Ghee)</option>
                  <option value="18">18% (Biscuits, Soaps, Shampoos)</option>
                  <option value="28">28% (Aerated Drinks)</option>
                </select>
              </div>

              {/* Opening Stock */}
              <div className="space-y-1.5">
                <Label htmlFor="stock" className="text-xs font-bold">Current Stock Quantity *</Label>
                <Input 
                  id="stock" 
                  value={formData.stock} 
                  onChange={handleChange} 
                  type="number" 
                  placeholder="0" 
                  required 
                  className="font-mono text-base font-bold"
                />
                <p className="text-[11px] text-muted-foreground">Units available on shelf/warehouse</p>
              </div>

              {/* Min Stock Alert */}
              <div className="space-y-1.5">
                <Label htmlFor="minStock" className="text-xs font-bold">Low Stock Alert Threshold</Label>
                <Input 
                  id="minStock" 
                  value={formData.minStock} 
                  onChange={handleChange} 
                  type="number" 
                  placeholder="5" 
                  className="font-mono text-base"
                />
                <p className="text-[11px] text-muted-foreground">Alerts when inventory falls below this</p>
              </div>
            </div>

            {/* Profit Margin & Customer Discount Banner */}
            {marginData && (
              <div className="mt-4 p-4 rounded-xl border bg-muted/30 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${marginData.profit > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-muted-foreground block uppercase">Store Profit / Margin:</span>
                    <p className={`text-base font-black ${marginData.profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      ₹{marginData.profit.toFixed(2)} per unit ({marginData.margin.toFixed(1)}% margin)
                    </p>
                  </div>
                </div>

                {marginData.discount > 0 && (
                  <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l sm:pl-4 pt-3 sm:pt-0">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <Percent className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground block uppercase">D-Mart Style Savings:</span>
                      <p className="text-base font-black text-blue-600 dark:text-blue-400">
                        Customer Saves ₹{marginData.discount.toFixed(2)} ({marginData.discountPercent.toFixed(0)}% OFF MRP)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Wholesale & Shelf Placement */}
          <div className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 font-black text-[10px] uppercase tracking-wider">Advanced</span>
                  Wholesale Tiers & Warehouse Placement
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set wholesale rates, automatic bulk tier quantity discounts, and rack locations.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="wholesalePrice" className="text-xs font-bold">Wholesale Price (₹)</Label>
                <Input 
                  id="wholesalePrice" 
                  value={formData.wholesalePrice} 
                  onChange={handleChange} 
                  type="number" 
                  step="0.01" 
                  placeholder="e.g. 95.00"
                />
                <p className="text-[11px] text-muted-foreground">Applied in Wholesale POS mode</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bulkMinQty" className="text-xs font-bold">Bulk Discount Min Qty</Label>
                <Input 
                  id="bulkMinQty" 
                  value={formData.bulkMinQty} 
                  onChange={handleChange} 
                  type="number" 
                  placeholder="e.g. 5 or 10"
                />
                <p className="text-[11px] text-muted-foreground">Min qty to trigger bulk price</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bulkPrice" className="text-xs font-bold">Bulk Unit Price (₹)</Label>
                <Input 
                  id="bulkPrice" 
                  value={formData.bulkPrice} 
                  onChange={handleChange} 
                  type="number" 
                  step="0.01" 
                  placeholder="e.g. 90.00"
                />
                <p className="text-[11px] text-muted-foreground">Auto-applied when cart qty reaches threshold</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rackLocation" className="text-xs font-bold">Rack / Shelf Location</Label>
                <Input 
                  id="rackLocation" 
                  value={formData.rackLocation} 
                  onChange={handleChange} 
                  placeholder="e.g. Rack A-3, Shelf 2"
                />
                <p className="text-[11px] text-muted-foreground">Speeds up warehouse picking</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reorderQty" className="text-xs font-bold">Auto Reorder Quantity</Label>
                <Input 
                  id="reorderQty" 
                  value={formData.reorderQty} 
                  onChange={handleChange} 
                  type="number" 
                  placeholder="e.g. 50"
                />
                <p className="text-[11px] text-muted-foreground">Suggested purchase replenishment order size</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maxStock" className="text-xs font-bold">Maximum Stock Limit</Label>
                <Input 
                  id="maxStock" 
                  value={formData.maxStock} 
                  onChange={handleChange} 
                  type="number" 
                  placeholder="e.g. 200"
                />
                <p className="text-[11px] text-muted-foreground">Prevents overstocking dead capital</p>
              </div>
            </div>
          </div>

          {/* Section 5: Barcode & Thermal Sticker Printer */}
          <div className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between pb-2 border-b">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" /> Barcode & Thermal Sticker Printing
              </h2>
              <span className="text-xs text-muted-foreground font-mono">50mm × 25mm Label Ready</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sku" className="text-xs font-bold">SKU Code</Label>
                <div className="flex gap-2">
                  <Input id="sku" value={formData.sku} onChange={handleChange} placeholder="e.g. DAIRY-AMU-123" />
                  <Button type="button" variant="outline" size="icon" onClick={generateSmartSKU} title="Auto-generate Smart SKU">
                    <Wand2 className="h-4 w-4 text-purple-500" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expiryDate" className="text-xs font-bold">Expiry Date</Label>
                <Input id="expiryDate" type="date" value={formData.expiryDate} onChange={handleChange} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="barcode" className="text-xs font-bold">Barcode (EAN-13 / Code-128)</Label>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-3 text-xs" 
                      onClick={() => setShowScanner(true)}
                    >
                      <Camera className="mr-1.5 h-3.5 w-3.5" /> Scan Camera
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 px-3 text-xs text-primary font-bold" 
                      onClick={generateBarcode}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Generate Barcode
                    </Button>
                  </div>
                </div>
                <Input 
                  id="barcode" 
                  value={formData.barcode}
                  onChange={handleChange}
                  placeholder={formData.isLoose ? `Optional (Short code "${formData.shortCode || '1'}" will be used)` : "Scan with gun or enter barcode"} 
                  className="font-mono font-bold"
                />
              </div>

              {/* Live Thermal Sticker Preview */}
              {formData.barcode && (
                <div className="md:col-span-2 p-5 bg-muted/40 rounded-2xl border flex flex-col items-center justify-center">
                  <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider mb-3">
                    Sticker Print Preview (50mm × 25mm):
                  </span>
                  
                  <div 
                    id="barcode-label-area" 
                    className="w-72 bg-white text-black p-4 rounded-xl shadow-md border flex flex-col items-center text-center font-sans"
                  >
                    <p className="text-[11px] font-black uppercase tracking-wider text-gray-800 line-clamp-1">
                      {shopData?.shopName || shopData?.name || 'SUPERMARKET'}
                    </p>
                    <p className="text-xs font-extrabold text-black mt-0.5 line-clamp-1">
                      {formData.name || 'Product Item'}
                    </p>
                    <div className="my-1">
                      <svg ref={barcodeRef} className="max-w-full"></svg>
                    </div>
                    <div className="w-full flex justify-between items-baseline px-2 border-t pt-1 border-dashed border-gray-400">
                      {formData.mrp && Number(formData.mrp) > Number(formData.sellingPrice) ? (
                        <span className="text-[11px] text-gray-600 line-through">MRP: ₹{formData.mrp}</span>
                      ) : <span />}
                      <span className="text-sm font-black text-black">
                        OUR PRICE: ₹{formData.sellingPrice || '0'}
                      </span>
                    </div>
                  </div>

                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="mt-4 gap-2 font-bold shadow-xs bg-card"
                    onClick={() => {
                      const printWindow = window.open('', '', 'width=350,height=300');
                      const el = document.getElementById('barcode-label-area');
                      if (printWindow && el) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Print Barcode Label</title>
                              <style>
                                @media print {
                                  body { margin: 0; padding: 2mm; display: flex; align-items: center; justify-content: center; }
                                  @page { size: auto; margin: 0; }
                                }
                              </style>
                            </head>
                            <body>
                              ${el.outerHTML}
                              <script>window.onload = function() { window.print(); window.close(); };</script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }}
                  >
                    <Printer className="h-4 w-4" /> 1-Click Print Barcode Sticker
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="flex items-center justify-between border-t pt-6">
          <Button type="button" variant="outline" onClick={() => navigate('/products')} className="font-bold">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 h-11 text-sm shadow-md">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Product to Catalog
          </Button>
        </div>
      </form>
      
      {showScanner && (
        <CameraScanner 
          onScan={(code) => {
            setFormData(prev => ({ ...prev, barcode: code }));
            const match = findFMCGByBarcode(code);
            if (match && !formData.name) {
              applyFMCGTemplate(match);
            }
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
                  <h3 className="text-base font-bold">Add or Manage Categories</h3>
                  <p className="text-xs text-muted-foreground">Create custom categories for your kirana store catalog</p>
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
              <Label className="text-xs font-bold">Type New Category Name:</Label>
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
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add & Select
                </Button>
              </div>
            </div>

            {/* Quick 1-Click Indian Kirana Category Suggestions */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Or Choose Popular Indian Kirana Category:
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

            {/* Custom Created Categories list */}
            {customCategories.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs font-bold text-muted-foreground">
                  Your Custom Store Categories ({customCategories.length}):
                </Label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                  {customCategories.map(cat => (
                    <div 
                      key={cat} 
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        formData.category === cat 
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs' 
                          : 'bg-card text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      <button 
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, category: cat }));
                          setCategorySuccessMsg(`Category "${cat}" selected!`);
                          setTimeout(() => {
                            setShowCategoryModal(false);
                            setCategorySuccessMsg('');
                          }, 500);
                        }}
                        className="hover:underline"
                      >
                        {cat}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomCategory(cat);
                        }}
                        title={`Delete ${cat} from custom categories`}
                        className="ml-1 text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setShowCategoryModal(false); setCategorySuccessMsg(''); }}
                className="text-xs font-bold"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
