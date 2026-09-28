import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { Product } from '../types';
import { 
  Barcode, Printer, RefreshCw, 
  Layers, Sliders, Sparkles 
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

// Common loose grocery presets for fast Kirana setup
const LOOSE_PRESETS = [
  { name: 'Sugar (साखर)', unit: '1 kg', price: 44, mrp: 48, shelfMonths: 12 },
  { name: 'Sugar (साखर)', unit: '500 g', price: 23, mrp: 25, shelfMonths: 12 },
  { name: 'Toor Dal (तूर डाळ)', unit: '1 kg', price: 160, mrp: 175, shelfMonths: 6 },
  { name: 'Toor Dal (तूर डाळ)', unit: '500 g', price: 82, mrp: 90, shelfMonths: 6 },
  { name: 'Chana Dal (चणा डाळ)', unit: '1 kg', price: 90, mrp: 100, shelfMonths: 6 },
  { name: 'Chana Dal (चणा डाळ)', unit: '500 g', price: 46, mrp: 52, shelfMonths: 6 },
  { name: 'Moong Dal (मूग डाळ)', unit: '500 g', price: 65, mrp: 75, shelfMonths: 6 },
  { name: 'Poha (जाड पोहे)', unit: '1 kg', price: 55, mrp: 62, shelfMonths: 6 },
  { name: 'Poha (जाड पोहे)', unit: '500 g', price: 28, mrp: 32, shelfMonths: 6 },
  { name: 'Peanuts (शेंगदाणे)', unit: '1 kg', price: 130, mrp: 145, shelfMonths: 6 },
  { name: 'Peanuts (शेंगदाणे)', unit: '500 g', price: 66, mrp: 75, shelfMonths: 6 },
  { name: 'Rice - Kolam (तांदूळ)', unit: '5 kg', price: 340, mrp: 380, shelfMonths: 12 },
  { name: 'Wheat Flour (गहू पीठ)', unit: '5 kg', price: 220, mrp: 250, shelfMonths: 3 },
  { name: 'Jaggery (सेंद्रिय गूळ)', unit: '1 kg', price: 65, mrp: 75, shelfMonths: 6 },
  { name: 'Cumin Seeds (जिरे)', unit: '100 g', price: 38, mrp: 45, shelfMonths: 12 },
  { name: 'Mustard (मोहरी)', unit: '200 g', price: 30, mrp: 35, shelfMonths: 12 },
];

export default function BarcodePrint() {
  const { shopData } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Label configuration
  const [itemName, setItemName] = useState('Sugar (साखर)');
  const [netWeight, setNetWeight] = useState('1 kg');
  const [sellingPrice, setSellingPrice] = useState('44');
  const [mrp, setMrp] = useState('48');
  const [barcodeValue, setBarcodeValue] = useState('890100100012');
  const [packDate, setPackDate] = useState(new Date().toISOString().slice(0, 10));
  const [bestBeforeDays, setBestBeforeDays] = useState('180');
  const [printCopies, setPrintCopies] = useState('12');
  const [labelFormat, setLabelFormat] = useState<'thermal-50x25' | 'thermal-50x35' | 'a4-24' | 'a4-40'>('thermal-50x25');

  const previewSvgRef = useRef<SVGSVGElement | null>(null);

  // Generate random unique 12-digit barcode for loose packs
  const generateNewBarcode = () => {
    const prefix = '890'; // India prefix
    const random = Math.floor(100000000 + Math.random() * 900000000);
    setBarcodeValue(`${prefix}${random}`);
  };

  // Fetch store inventory
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const list = await api.products.list();
        setProducts(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Error fetching products:', e);
      }
    };
    loadProducts();
  }, []);

  // Update preview barcode
  useEffect(() => {
    if (previewSvgRef.current && barcodeValue) {
      try {
        JsBarcode(previewSvgRef.current, barcodeValue, {
          format: 'CODE128',
          width: 1.4,
          height: 38,
          displayValue: true,
          fontSize: 11,
          margin: 4,
          textMargin: 2
        });
      } catch (err) {
        console.warn('Barcode render error:', err);
      }
    }
  }, [barcodeValue]);

  // Handle selecting an existing product
  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find(p => p.id === id);
    if (prod) {
      setItemName(prod.name);
      setNetWeight(prod.unit || '1 Pack');
      setSellingPrice(String(prod.sellingPrice || ''));
      setMrp(String(prod.mrp || prod.sellingPrice || ''));
      if (prod.barcode) {
        setBarcodeValue(prod.barcode);
      } else {
        generateNewBarcode();
      }
    }
  };

  // Handle selecting a preset
  const handleSelectPreset = (preset: typeof LOOSE_PRESETS[0]) => {
    setSelectedProductId('');
    setItemName(preset.name);
    setNetWeight(preset.unit);
    setSellingPrice(String(preset.price));
    setMrp(String(preset.mrp));
    setBestBeforeDays(String(preset.shelfMonths * 30));
    generateNewBarcode();
  };

  // Expiry date calculation
  const getExpiryDate = () => {
    try {
      const d = new Date(packDate);
      d.setDate(d.getDate() + parseInt(bestBeforeDays || '180'));
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalCopies = Math.max(1, Math.min(100, parseInt(printCopies) || 1));
  const shopTitle = shopData?.shopName || shopData?.name || 'MartGPT Store';

  return (
    <div className="space-y-6 pb-12 animate-fadeInUp">
      {/* Header - Screen only */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Barcode className="h-7 w-7 text-primary" /> Loose Item Barcode Generator & Printer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Print scan-ready barcode price labels for loose items (sugar, pulses, grains, oil, spices)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handlePrint} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md">
            <Printer className="h-4 w-4" /> Print {totalCopies} Labels Now
          </Button>
        </div>
      </div>

      {/* Main Configuration Grid - Screen only */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Label Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Presets */}
          <div className="kirana-card p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> Quick Grocery Presets (एका क्लिकवर निवडा)
            </h3>
            <div className="flex flex-wrap gap-2">
              {LOOSE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border bg-muted/30 hover:bg-primary/10 hover:border-primary transition-all text-left font-medium"
                >
                  {preset.name} - <span className="font-bold text-primary">₹{preset.price}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Product Picker or Custom Form */}
          <div className="kirana-card p-6 space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2 border-b pb-3">
              <Sliders className="h-5 w-5 text-primary" /> Label & Product Details
            </h3>

            {/* Select existing inventory product */}
            <div>
              <Label className="text-xs text-muted-foreground">Select From Store Products (Optional)</Label>
              <select
                value={selectedProductId}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="w-full mt-1.5 px-3 py-2 text-sm rounded-lg border bg-background"
              >
                <option value="">-- Or Enter Custom Item Below --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit || 'Pack'}) - ₹{p.sellingPrice} {p.barcode ? `[${p.barcode}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="itemName">Item Name (इंग्रजी / मराठी)</Label>
                <Input
                  id="itemName"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Sugar / साखर"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="netWeight">Net Weight / Pack Size</Label>
                <Input
                  id="netWeight"
                  value={netWeight}
                  onChange={(e) => setNetWeight(e.target.value)}
                  placeholder="e.g. 1 kg, 500 g, 5 L"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sellingPrice">Selling Price (₹)</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="44"
                  className="mt-1 font-bold text-emerald-600"
                />
              </div>
              <div>
                <Label htmlFor="mrp">MRP (₹)</Label>
                <Input
                  id="mrp"
                  type="number"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder="48"
                  className="mt-1 text-muted-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="barcodeVal">Barcode Number</Label>
                  <button
                    type="button"
                    onClick={generateNewBarcode}
                    className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" /> Auto-Generate
                  </button>
                </div>
                <Input
                  id="barcodeVal"
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  className="mt-1 font-mono tracking-wider"
                />
              </div>
              <div>
                <Label htmlFor="packDate">Packaging Date</Label>
                <Input
                  id="packDate"
                  type="date"
                  value={packDate}
                  onChange={(e) => setPackDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bestBefore">Shelf Life (Days)</Label>
                <select
                  id="bestBefore"
                  value={bestBeforeDays}
                  onChange={(e) => setBestBeforeDays(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm rounded-lg border bg-background"
                >
                  <option value="30">1 Month (30 Days)</option>
                  <option value="60">2 Months (60 Days)</option>
                  <option value="90">3 Months (90 Days)</option>
                  <option value="180">6 Months (180 Days)</option>
                  <option value="365">1 Year (365 Days)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="copies">Number of Labels to Print</Label>
                <Input
                  id="copies"
                  type="number"
                  min="1"
                  max="100"
                  value={printCopies}
                  onChange={(e) => setPrintCopies(e.target.value)}
                  className="mt-1 font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Form: Live Preview & Print Settings */}
        <div className="lg:col-span-5 space-y-6">
          {/* Print Format Selector */}
          <div className="kirana-card p-5 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Printer & Paper Format
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
              <button
                type="button"
                onClick={() => setLabelFormat('thermal-50x25')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  labelFormat === 'thermal-50x25'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'bg-card hover:bg-muted/40'
                }`}
              >
                <p className="font-semibold">Thermal 50×25 mm</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Standard 2×1 inch label roll</p>
              </button>

              <button
                type="button"
                onClick={() => setLabelFormat('thermal-50x35')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  labelFormat === 'thermal-50x35'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'bg-card hover:bg-muted/40'
                }`}
              >
                <p className="font-semibold">Thermal 50×35 mm</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Medium 2×1.4 inch roll</p>
              </button>

              <button
                type="button"
                onClick={() => setLabelFormat('a4-24')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  labelFormat === 'a4-24'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'bg-card hover:bg-muted/40'
                }`}
              >
                <p className="font-semibold">A4 Sheet (24 Labels)</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">3 columns × 8 rows sheet</p>
              </button>

              <button
                type="button"
                onClick={() => setLabelFormat('a4-40')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  labelFormat === 'a4-40'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'bg-card hover:bg-muted/40'
                }`}
              >
                <p className="font-semibold">A4 Sheet (40 Labels)</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">4 columns × 10 rows sheet</p>
              </button>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="kirana-card p-6 flex flex-col items-center">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Real-Time Label Preview
            </h3>

            {/* Sticker Preview Box */}
            <div className="w-[280px] bg-white text-black p-3 rounded-lg border-2 border-dashed border-gray-400 shadow-md flex flex-col items-center justify-between text-center select-none">
              {/* Store Header */}
              <div className="w-full border-b border-black pb-1 mb-1">
                <p className="text-[12px] font-extrabold uppercase tracking-tight truncate leading-tight">
                  {shopTitle}
                </p>
              </div>

              {/* Item Name & Net Wt */}
              <div className="my-0.5">
                <p className="text-[14px] font-black leading-tight line-clamp-2">
                  {itemName || 'Item Name'}
                </p>
                <p className="text-[11px] font-bold text-gray-700 mt-0.5">
                  Net Wt: {netWeight || '1 kg'}
                </p>
              </div>

              {/* Barcode SVG */}
              <div className="w-full flex justify-center my-0.5">
                <svg ref={previewSvgRef} className="max-w-full h-auto"></svg>
              </div>

              {/* Price Details */}
              <div className="w-full flex items-baseline justify-between border-t border-black pt-1 px-1 mt-1 text-[11px]">
                {mrp && parseFloat(mrp) > parseFloat(sellingPrice || '0') ? (
                  <span className="text-gray-500 line-through">MRP: ₹{mrp}</span>
                ) : (
                  <span></span>
                )}
                <span className="text-[15px] font-black text-black">
                  ₹{sellingPrice || '0'}
                </span>
              </div>

              {/* Dates Footer */}
              <div className="w-full flex justify-between text-[9px] text-gray-600 mt-1 pt-0.5 border-t border-gray-200">
                <span>Pkd: {packDate}</span>
                <span>Exp: {getExpiryDate()}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              ✓ Ready for instant barcode scanner reading at POS counter
            </p>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY AREA: Outputs the exact physical sticker grid */}
      <div className="hidden print:block print:w-full print:m-0 print:p-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden; }
            #printable-labels-area, #printable-labels-area * { visibility: visible; }
            #printable-labels-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
            }
            @page {
              size: auto;
              margin: 4mm;
            }
            .label-sticker {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        `}} />

        <div id="printable-labels-area" className={`
          ${labelFormat.startsWith('thermal') 
            ? 'flex flex-col items-center gap-2 p-1' 
            : labelFormat === 'a4-24' 
              ? 'grid grid-cols-3 gap-2 p-2' 
              : 'grid grid-cols-4 gap-1 p-1'
          }
        `}>
          {Array.from({ length: totalCopies }).map((_, index) => (
            <div
              key={index}
              className={`
                label-sticker border border-black bg-white text-black p-2 flex flex-col items-center justify-between text-center
                ${labelFormat === 'thermal-50x25' ? 'w-[48mm] h-[25mm] text-[9px] p-1' : ''}
                ${labelFormat === 'thermal-50x35' ? 'w-[48mm] h-[34mm] text-[10px] p-1.5' : ''}
                ${labelFormat === 'a4-24' ? 'w-[64mm] h-[33mm] text-[10px] p-1.5 rounded' : ''}
                ${labelFormat === 'a4-40' ? 'w-[48mm] h-[25mm] text-[9px] p-1 rounded' : ''}
              `}
            >
              <div className="w-full border-b border-black pb-0.5 leading-none">
                <span className="font-extrabold uppercase text-[10px] truncate block">
                  {shopTitle}
                </span>
              </div>

              <div className="my-0.5 leading-tight">
                <span className="font-black text-[12px] block truncate">
                  {itemName}
                </span>
                <span className="font-bold text-[9px] text-gray-700">
                  Net: {netWeight}
                </span>
              </div>

              {/* Barcode representation */}
              <div className="w-full flex justify-center py-0.5">
                <BarcodeRenderer value={barcodeValue} />
              </div>

              <div className="w-full flex justify-between items-baseline border-t border-black pt-0.5 px-0.5 font-bold">
                {mrp && parseFloat(mrp) > parseFloat(sellingPrice || '0') && (
                  <span className="line-through text-gray-600 text-[9px]">MRP: ₹{mrp}</span>
                )}
                <span className="text-[13px] font-black ml-auto">
                  ₹{sellingPrice}
                </span>
              </div>

              <div className="w-full flex justify-between text-[7px] text-gray-500 mt-0.5 border-t border-gray-300">
                <span>Pkd: {packDate}</span>
                <span>Exp: {getExpiryDate()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Subcomponent to reliably render barcode in print grid
function BarcodeRenderer({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 1.1,
          height: 24,
          displayValue: true,
          fontSize: 8,
          margin: 1,
          textMargin: 1
        });
      } catch (err) {
        console.warn('Print barcode render error:', err);
      }
    }
  }, [value]);

  return <svg ref={svgRef} className="max-w-[120px] h-auto"></svg>;
}
