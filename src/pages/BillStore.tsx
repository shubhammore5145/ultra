import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FileText, Search, Printer, MessageCircle, Eye, 
  Trash2, RefreshCw, Calendar, IndianRupee,
  CreditCard, Banknote, User,
  X, TrendingUp, Sparkles, 
  Package
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import JsBarcode from 'jsbarcode';
import type { Transaction, Customer, Product } from '../types';

export default function BillStore() {
  const { shopData } = useAuth();
  const [sales, setSales] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date & Filter States
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | 'thisMonth' | 'customMonth' | 'all'>('thisMonth');
  const [customMonth, setCustomMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'profit' | 'amount' | 'oldest'>('newest');
  
  const [selectedBill, setSelectedBill] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const [txList, custList, prodList] = await Promise.all([
        api.transactions.list(),
        api.customers.list(),
        api.products.list()
      ]);
      setSales(Array.isArray(txList) ? txList : []);
      setCustomers(Array.isArray(custList) ? custList : []);
      setProducts(Array.isArray(prodList) ? prodList : []);
    } catch (err: any) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [shopData?.shopId]);

  // Robust date parser
  const parseBillDate = (dVal: any): Date | null => {
    if (!dVal) return null;
    if (dVal instanceof Date) return isNaN(dVal.getTime()) ? null : dVal;
    let s = String(dVal).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s) && !s.includes('Z') && !s.includes('+')) {
      s = s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  // Customer map for rapid lookup
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  // Product maps for accurate purchase price & profit lookup
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const productNameMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      if (p.name) map.set(p.name.trim().toLowerCase(), p);
    });
    return map;
  }, [products]);

  // Customer info helper for a bill
  const getBillCustomer = useCallback((bill: Transaction) => {
    const custFromMap = bill.customerId ? customerMap.get(bill.customerId) : null;
    const name = custFromMap?.name || (bill as any).customerName || '';
    const phone = custFromMap?.phone || (bill as any).customerPhone || '';
    return { name, phone, isKnown: Boolean(name || phone) };
  }, [customerMap]);

  // Per-Bill Profit Calculation
  const getBillProfit = useCallback((bill: Transaction) => {
    let costTotal = 0;
    const revenue = Number(bill.totalAmount || 0);

    (bill.items || []).forEach(it => {
      const qty = Number(it.qty || 1);
      let unitCost = Number((it as any).purchasePrice);

      // If unitCost is missing or 0, fallback to live product database by ID or Name
      if (!unitCost || unitCost <= 0) {
        const prod = (it.id && productMap.get(it.id)) || (it.name && productNameMap.get(it.name.trim().toLowerCase()));
        if (prod && Number(prod.purchasePrice) > 0) {
          unitCost = Number(prod.purchasePrice);
        }
      }

      costTotal += (unitCost || 0) * qty;
    });

    const profit = revenue - costTotal;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      cost: costTotal,
      revenue,
      profit: Math.round(profit * 100) / 100,
      margin: Math.round(margin * 10) / 10,
      hasCostData: costTotal > 0
    };
  }, [productMap, productNameMap]);

  // Filtered and Sorted Bills
  const filteredBills = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const list = sales.filter((bill) => {
      // 1. Date filter
      if (dateFilter !== 'all' && bill.createdAt) {
        const d = parseBillDate(bill.createdAt);
        if (d) {
          if (dateFilter === 'today') {
            if (d < todayStart) return false;
          } else if (dateFilter === 'yesterday') {
            if (d < yesterdayStart || d >= todayStart) return false;
          } else if (dateFilter === '7days') {
            if (d < sevenDaysAgo) return false;
          } else if (dateFilter === 'thisMonth') {
            if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
          } else if (dateFilter === 'customMonth' && customMonth) {
            const [y, m] = customMonth.split('-').map(Number);
            if (d.getFullYear() !== y || d.getMonth() !== (m - 1)) return false;
          }
        }
      }

      // 2. Payment mode filter
      if (paymentFilter !== 'all') {
        if (bill.paymentMethod !== paymentFilter) return false;
      }

      // 3. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const billIdMatch = String(bill.id || '').toLowerCase().includes(q);
        const cust = getBillCustomer(bill);
        const custNameMatch = cust.name.toLowerCase().includes(q);
        const custPhoneMatch = cust.phone.includes(q);
        const itemsMatch = bill.items?.some(it => it.name?.toLowerCase().includes(q)) || false;

        if (!billIdMatch && !custNameMatch && !custPhoneMatch && !itemsMatch) {
          return false;
        }
      }

      return true;
    });

    // 4. Sorting
    list.sort((a, b) => {
      if (sortBy === 'profit') {
        return getBillProfit(b).profit - getBillProfit(a).profit;
      }
      if (sortBy === 'amount') {
        return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
      }
      if (sortBy === 'oldest') {
        const da = parseBillDate(a.createdAt)?.getTime() || 0;
        const db = parseBillDate(b.createdAt)?.getTime() || 0;
        return da - db;
      }
      // default: newest
      const da = parseBillDate(a.createdAt)?.getTime() || 0;
      const db = parseBillDate(b.createdAt)?.getTime() || 0;
      return db - da;
    });

    return list;
  }, [sales, dateFilter, paymentFilter, searchTerm, customMonth, sortBy, getBillCustomer, getBillProfit]);

  // Summary Metrics including Total Profit
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCost = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let udharTotal = 0;
    let udharCount = 0;

    filteredBills.forEach(b => {
      const amt = Number(b.totalAmount) || 0;
      totalRevenue += amt;
      if (b.paymentMethod === 'cash') cashTotal += amt;
      else if (b.paymentMethod === 'upi') upiTotal += amt;
      else if (b.paymentMethod === 'udhar') {
        udharTotal += amt;
        udharCount++;
      }

      const pInfo = getBillProfit(b);
      totalProfit += pInfo.profit;
      totalCost += pInfo.cost;
    });

    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      count: filteredBills.length,
      revenue: totalRevenue,
      profit: totalProfit,
      cost: totalCost,
      margin: Math.round(margin * 10) / 10,
      cash: cashTotal,
      upi: upiTotal,
      udhar: udharTotal,
      udharCount,
      avg: filteredBills.length > 0 ? totalRevenue / filteredBills.length : 0
    };
  }, [filteredBills, getBillProfit]);

  // Cancel Bill (Move to Recycle Bin)
  const handleCancelBill = async (bill: Transaction) => {
    const billShortId = String(bill.id || '').slice(-6).toUpperCase();
    if (!window.confirm(`Are you sure you want to cancel Invoice #${billShortId} and move it to Recycle Bin?`)) {
      return;
    }
    setActionLoading(bill.id);
    try {
      await api.transactions.delete(bill.id, false, bill);
      setStatusMessage(`Invoice #${billShortId} moved to Recycle Bin. You can restore it anytime.`);
      await fetchBills();
    } catch (err: any) {
      alert('Failed to cancel invoice: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(null);
    }
  };

  // Re-print thermal receipt
  const printThermalReceipt = (bill: Transaction) => {
    const cust = getBillCustomer(bill);
    const shopName = shopData?.shopName || shopData?.name || 'Kirana Store';
    const shopAddr = shopData?.address || '';
    const shopPh = shopData?.phone || '';
    const isGstActive = (() => {
      try {
        const explicitFlag = localStorage.getItem('shop_gst_enabled');
        if (explicitFlag !== null) return JSON.parse(explicitFlag) === true;
        const rawShop = localStorage.getItem('auth_shop');
        if (rawShop) {
          const parsed = JSON.parse(rawShop);
          if (parsed.settings && typeof parsed.settings.gstEnabled === 'boolean') return parsed.settings.gstEnabled;
        }
      } catch {}
      if ((shopData as any)?.settings && typeof (shopData as any).settings.gstEnabled === 'boolean') return (shopData as any).settings.gstEnabled;
      return Boolean(shopData?.gstNumber && shopData.gstNumber.trim().length > 0);
    })();
    const shopGst = isGstActive ? (shopData?.gstNumber || '') : '';
    const billShortId = String(bill.id || '').slice(-8).toUpperCase();
    const barcodeValue = String(bill.id || '').slice(-12).toUpperCase();
    const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();

    let paperSpec: '58mm' | '80mm' = '80mm';
    try {
      const hwRaw = localStorage.getItem('hardware_settings');
      if (hwRaw) {
        const parsedHw = JSON.parse(hwRaw);
        if (parsedHw?.paperSize === '58mm') paperSpec = '58mm';
      } else if ((shopData as any)?.settings?.paperSize === '58mm' || (shopData as any)?.receiptPaperSize === '58mm') {
        paperSpec = '58mm';
      }
    } catch {}
    const printableWidth = paperSpec === '58mm' ? '48mm' : '72mm';
    const barcodeMaxWidth = paperSpec === '58mm' ? '44mm' : '64mm';

    // Generate crisp offline barcode SVG synchronously
    let barcodeSvgHtml = '';
    try {
      if (barcodeValue) {
        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(svgEl, barcodeValue, {
          format: 'CODE128',
          width: paperSpec === '58mm' ? 1.1 : 1.35,
          height: 34,
          displayValue: true,
          fontSize: 10,
          margin: 0,
          textMargin: 2
        });
        svgEl.style.width = '100%';
        svgEl.style.maxWidth = barcodeMaxWidth;
        svgEl.style.height = 'auto';
        svgEl.style.margin = '0 auto';
        svgEl.style.display = 'block';
        barcodeSvgHtml = svgEl.outerHTML;
      }
    } catch {}

    const printWindow = window.open('', '', 'width=380,height=640');
    if (!printWindow) return;

    const billItems = bill.items || [];
    const totalQtyCount = billItems.reduce((sum, it) => sum + Number(it.qty || 1), 0);
    const totalMrpValue = billItems.reduce((sum, it) => {
      const sp = Number(it.sellingPrice || 0);
      const mrp = Number(it.mrp || 0);
      return sum + ((mrp > sp ? mrp : sp) * Number(it.qty || 1));
    }, 0);
    const productSavings = billItems.reduce((sum, it) => {
      const sp = Number(it.sellingPrice || 0);
      const mrp = Number(it.mrp || 0);
      return sum + (mrp > sp ? (mrp - sp) * Number(it.qty || 1) : 0);
    }, 0);
    const totalSavings = productSavings + Number(bill.discountAmount || 0);
    const savingsPct = totalMrpValue > 0 ? Math.round((totalSavings / totalMrpValue) * 100) : 0;

    const itemsHtml = billItems.map((it, idx) => {
      const sp = Number(it.sellingPrice || 0);
      const mrp = Number(it.mrp || 0);
      const qty = Number(it.qty || 1);
      const hasDiscount = mrp > sp;
      const unitStr = it.unit ? ` (${it.unit})` : '';
      const qtyLabel = (it.unit === 'kg' || Boolean((it as any).isLoose)) && qty < 1
        ? `${Math.round(qty * 1000)}g`
        : qty;
      return `
        <div style="padding:3px 0;border-bottom:1px dotted #888;">
          <div style="font-weight:700;font-size:11.5px;line-height:1.25;word-break:break-word;color:#000;">
            ${idx + 1}. ${it.name}${unitStr}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;font-size:11px;font-weight:600;margin-top:1px;">
            <span style="flex:1;min-width:0;color:#000;">
              ${hasDiscount ? `<span style="margin-right:4px;">MRP:<span style="text-decoration:line-through;">₹${mrp.toFixed(2)}</span></span>` : ''}
              <span style="font-weight:800;">₹${sp.toFixed(2)}</span>
              <span style="margin-left:4px;font-weight:700;">× ${qtyLabel}</span>
            </span>
            <span style="flex-shrink:0;white-space:nowrap;font-weight:900;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;">
              ₹${(sp * qty).toFixed(2)}
            </span>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Receipt #${billShortId}</title>
          <style>
            @page { margin: 0mm; size: ${paperSpec} auto; }
            * { box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              width: ${printableWidth};
              max-width: ${printableWidth};
              margin: 0;
              padding: 1.5mm 2.5mm;
              font-size: 11.5px;
              color: #000;
              background: #fff;
              line-height: 1.3;
              font-variant-numeric: tabular-nums;
            }
            .center { text-align: center; }
            .bold { font-weight: 800; }
            .dashed { border-bottom: 1.5px dashed #000; margin: 5px 0; }
            .row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; margin: 2px 0; font-size: 11px; font-weight: 600; }
            .num { white-space: nowrap; flex-shrink: 0; text-align: right; }
            .title { font-size: 17px; font-weight: 900; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.3px; word-break: break-word; }
            .sub { font-size: 11px; font-weight: 600; margin: 1.5px 0; color: #000; line-height: 1.25; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 class="title">${shopName}</h2>
            ${shopAddr ? `<p class="sub">${shopAddr}</p>` : ''}
            ${shopPh ? `<p class="sub" style="font-weight:800;">Ph: ${shopPh}</p>` : ''}
            ${shopGst ? `<p class="sub" style="font-weight:900;">GSTIN: ${shopGst}</p>` : ''}
            <div style="margin:5px 0 3px;font-weight:900;font-size:11.5px;border-top:1.5px dashed #000;border-bottom:1.5px dashed #000;padding:3px 0;">
              ${shopGst ? '*** RETAIL TAX INVOICE ***' : '*** RETAIL INVOICE ***'}
            </div>
          </div>
          <div class="row"><span><b>Inv:</b> #${billShortId}</span><span class="num"><b>Date:</b> ${billDate.toLocaleDateString('en-IN')}</span></div>
          <div class="row"><span><b>Time:</b> ${billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span><span class="num"><b>Mode:</b> ${(bill.paymentMethod || 'CASH').toUpperCase()}</span></div>
          ${cust.name || cust.phone ? `<div class="row"><span><b>Customer:</b> ${cust.name || ''}</span><span class="num">${cust.phone ? '+91 ' + cust.phone : ''}</span></div>` : ''}
          <div class="dashed"></div>
          <div style="display:flex;justify-content:space-between;font-weight:900;font-size:11px;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:3px;">
            <span>ITEM (RATE × QTY)</span>
            <span class="num">AMOUNT</span>
          </div>
          ${itemsHtml}
          <div class="dashed"></div>
          <div class="row"><span>Items / Qty:</span><span class="num">${billItems.length} items (${totalQtyCount} qty)</span></div>
          <div class="row"><span>Subtotal:</span><span class="num">₹${Number(bill.subtotal || bill.totalAmount || 0).toFixed(2)}</span></div>
          ${Number(bill.discountAmount) > 0 ? `<div class="row bold"><span>Discount:</span><span class="num">-₹${Number(bill.discountAmount).toFixed(2)}</span></div>` : ''}
          ${Number(bill.taxAmount) > 0 ? `<div class="row"><span>Tax (GST):</span><span class="num">+₹${Number(bill.taxAmount).toFixed(2)}</span></div>` : ''}
          <div style="border-bottom:1.5px solid #000;margin:4px 0;"></div>
          <div class="row" style="font-size:15.5px;font-weight:900;padding:2px 0;"><span>NET TOTAL:</span><span class="num">₹${Number(bill.totalAmount || 0).toFixed(2)}</span></div>
          ${Number(bill.cashTendered || 0) > 0 ? `
            <div style="border-top:1px dashed #000;margin-top:2px;padding-top:2px;">
              <div class="row"><span>Cash Tendered:</span><span class="num">₹${Number(bill.cashTendered).toFixed(2)}</span></div>
              ${Number(bill.changeReturn || 0) > 0 ? `<div class="row bold"><span>Change Return:</span><span class="num">₹${Number(bill.changeReturn).toFixed(2)}</span></div>` : ''}
            </div>
          ` : ''}
          ${totalSavings > 0 ? `
            <div style="text-align:center;padding:4px 0;font-size:11.5px;font-weight:900;border-top:1.5px dashed #000;border-bottom:1.5px dashed #000;margin-top:4px;">
              You Saved: ₹${totalSavings.toFixed(2)} (${savingsPct}% savings)
            </div>
          ` : `<div class="dashed"></div>`}
          <div style="text-align:center;margin:6px 0 3px;">
            ${barcodeSvgHtml}
            <div style="font-size:9.5px;font-weight:800;margin-top:2px;">Scan Barcode for Return / Exchange</div>
          </div>
          <p class="center" style="margin:5px 0 1px;font-size:11px;font-weight:900;">Thank You For Shopping! Please Visit Again</p>
          <p class="center" style="margin:3px 0 2mm;font-size:12.5px;font-weight:900;color:#000;letter-spacing:0.3px;">Software by Varuag Labs</p>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 80);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // WhatsApp Sender
  const sendWhatsAppReceipt = (bill: Transaction) => {
    const cust = getBillCustomer(bill);
    let targetPhone = cust.phone;
    if (!targetPhone || targetPhone.length < 10) {
      const input = prompt('Enter customer 10-digit WhatsApp number:', cust.phone || '');
      if (!input) return;
      targetPhone = input.replace(/\D/g, '').slice(-10);
    }
    if (targetPhone.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    const shopName = shopData?.shopName || shopData?.name || 'Kirana Store';
    const shopAddr = shopData?.address ? `📍 ${shopData.address}\n` : '';
    const shopPh = shopData?.phone ? `📞 Ph: ${shopData.phone}\n` : '';
    const billShortId = String(bill.id || '').slice(-8).toUpperCase();
    const d = bill.createdAt ? new Date(bill.createdAt) : new Date();
    const dateStr = d.toLocaleDateString('en-IN');
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const receiptLink = `${window.location.origin}/receipt/${bill.id}`;

    const itemsText = (bill.items || [])
      .map((it, idx) => `${idx + 1}. *${it.name}* (${it.qty}x) = ₹${(Number(it.sellingPrice) * Number(it.qty)).toFixed(2)}`)
      .join('\n');

    let msg = `🏪 *${shopName.toUpperCase()}*\n`;
    if (shopAddr) msg += shopAddr;
    if (shopPh) msg += shopPh;
    msg += `────────────────────\n`;
    msg += `🧾 *TAX / RETAIL INVOICE*\n`;
    msg += `*Inv No:* #${billShortId}\n`;
    msg += `*Date:* ${dateStr}, ${timeStr}\n`;
    if (cust.name) {
      msg += `*Customer:* ${cust.name} (+91 ${targetPhone})\n`;
    }
    msg += `*Mode:* ${(bill.paymentMethod || 'Cash').toUpperCase()}\n`;
    msg += `────────────────────\n`;
    msg += `🛒 *PURCHASED ITEMS:*\n${itemsText}\n`;
    msg += `────────────────────\n`;
    if (Number(bill.discountAmount) > 0) {
      msg += `Subtotal: ₹${Number(bill.subtotal || bill.totalAmount).toFixed(2)}\n`;
      msg += `Discount: -₹${Number(bill.discountAmount).toFixed(2)}\n`;
    }
    msg += `💰 *TOTAL AMOUNT: ₹${Number(bill.totalAmount || 0).toFixed(2)}*\n`;
    msg += `────────────────────\n`;
    msg += `📄 *View Full E-Bill / PDF:*\n${receiptLink}\n\n`;
    msg += `🙏 *Thank you for shopping with us! Please visit again.* 😊`;

    window.open(`https://wa.me/91${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="p-3 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
                Bill Store & Invoice History
              </h1>
              <p className="text-xs text-muted-foreground">
                Track bill-by-bill profits, customer receipts, re-print thermal bills, or share via WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchBills} 
            disabled={loading}
            className="text-xs font-semibold h-9 rounded-xl border-border/80"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="p-3.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{statusMessage}</span>
          <Button variant="ghost" size="sm" onClick={() => setStatusMessage(null)} className="h-6 text-[10px]">
            Dismiss
          </Button>
        </div>
      )}

      {/* KPI Metrics Cards (5 Cards with Net Profit Highlight) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        {/* Total Bills */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Bills</span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-foreground">{summary.count}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Average: ₹{summary.avg.toFixed(0)} / bill</p>
          </div>
        </div>

        {/* Total Sales */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Sales</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <IndianRupee className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              ₹{summary.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Selected Range</p>
          </div>
        </div>

        {/* Net Profit (KEY HIGHLIGHT) */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-50/80 via-card to-emerald-500/5 dark:from-emerald-950/40 dark:via-card dark:to-emerald-900/10 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-emerald-600 animate-pulse" /> Net Profit
            </span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{summary.profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 px-1.5 py-0.2 rounded-md">
                {summary.margin}% Margin
              </span>
            </div>
          </div>
        </div>

        {/* Cash & UPI Collected */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Paid Received</span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Banknote className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-foreground">
              ₹{(summary.cash + summary.upi).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              Cash: ₹{summary.cash.toFixed(0)} | UPI: ₹{summary.upi.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Pending Udhar */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Pending Udhar</span>
            <div className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <CreditCard className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
              ₹{summary.udhar.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{summary.udharCount} credit bills</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by invoice #, customer name, mobile, or item..."
              className="pl-9 h-10 text-xs sm:text-sm font-medium rounded-xl bg-background"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Payment Method Select */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 h-10 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
            >
              <option value="all">All Payment Methods</option>
              <option value="cash">💵 Cash</option>
              <option value="upi">📱 UPI / QR</option>
              <option value="udhar">📕 Udhar (Credit)</option>
              <option value="card">💳 Card</option>
              <option value="split">⚡ Split Payment</option>
            </select>

            {/* Sort Order */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border border-input bg-background px-3 h-10 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
            >
              <option value="newest">⏰ Newest First</option>
              <option value="profit">💰 Highest Profit</option>
              <option value="amount">📈 Highest Bill Amount</option>
              <option value="oldest">📅 Oldest First</option>
            </select>
          </div>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 mr-1">
            <Calendar className="h-3.5 w-3.5 text-primary" /> Period:
          </span>
          {[
            { id: 'thisMonth', label: 'This Month' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: 'all', label: 'All Invoices' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setDateFilter(pill.id as any)}
              className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                dateFilter === pill.id
                  ? 'bg-primary text-white border-primary font-bold shadow-2xs'
                  : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted font-medium'
              }`}
            >
              {pill.label}
            </button>
          ))}

          {/* Month Calendar Picker */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border transition-all ${
            dateFilter === 'customMonth'
              ? 'bg-primary text-white border-primary font-bold shadow-2xs'
              : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted font-medium'
          }`}>
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="text-xs font-bold shrink-0">Month:</span>
            <input
              type="month"
              value={customMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setCustomMonth(e.target.value);
                  setDateFilter('customMonth');
                }
              }}
              className="bg-transparent border-none text-xs font-bold cursor-pointer focus:outline-none focus:ring-0 p-0 text-inherit font-mono"
            />
          </div>
          
          <span className="ml-auto text-xs text-muted-foreground font-bold">
            Found {filteredBills.length} invoices
          </span>
        </div>
      </div>

      {/* Bills Display: Modern Desktop Table + Responsive Mobile Cards */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <RefreshCw className="h-7 w-7 animate-spin mx-auto text-primary" />
            <p className="text-xs font-medium">Loading invoices...</p>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-bold text-base text-foreground">No invoices found</p>
            <p className="text-xs">Try adjusting your search query or date range filters above.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider font-extrabold border-b border-border/80">
                  <tr>
                    <th className="px-4 py-3.5">Invoice #</th>
                    <th className="px-4 py-3.5">Date & Time</th>
                    <th className="px-4 py-3.5">Customer Details</th>
                    <th className="px-4 py-3.5">Payment Mode</th>
                    <th className="px-4 py-3.5">Items Purchased</th>
                    <th className="px-4 py-3.5 text-right">Bill Total (₹)</th>
                    <th className="px-4 py-3.5 text-right">Profit Margin 💰</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredBills.map((bill) => {
                    const cust = getBillCustomer(bill);
                    const billShortId = String(bill.id || '').slice(-6).toUpperCase();
                    const itemCount = bill.items?.length || 0;
                    const previewNames = (bill.items || []).slice(0, 2).map(it => it.name).join(', ');
                    const pInfo = getBillProfit(bill);

                    return (
                      <tr key={bill.id} className="hover:bg-muted/30 transition-colors group">
                        {/* Invoice ID */}
                        <td className="px-4 py-3.5 font-mono font-bold text-foreground">
                          <span className="bg-muted px-2 py-1 rounded-md text-xs">
                            #{billShortId}
                          </span>
                        </td>

                        {/* Date & Time */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="font-bold text-foreground">
                            {bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('en-IN') : '—'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {bill.createdAt ? new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </td>

                        {/* Customer Info */}
                        <td className="px-4 py-3.5">
                          {cust.isKnown ? (
                            <div>
                              <p className="font-bold text-foreground flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-primary" /> {cust.name || 'Customer'}
                              </p>
                              {cust.phone && (
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  📞 +91 {cust.phone}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">Walk-in (Cash Customer)</span>
                          )}
                        </td>

                        {/* Payment Mode */}
                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                            bill.paymentMethod === 'cash' 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                              : bill.paymentMethod === 'upi'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : bill.paymentMethod === 'udhar'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {bill.paymentMethod === 'cash' ? '💵 Cash' : bill.paymentMethod === 'upi' ? '📱 UPI' : bill.paymentMethod === 'udhar' ? '📕 Udhar' : bill.paymentMethod}
                          </span>
                        </td>

                        {/* Items Summary */}
                        <td className="px-4 py-3.5 text-muted-foreground max-w-[210px] truncate" title={bill.items?.map(i => `${i.name} (${i.qty})`).join(', ')}>
                          <span className="font-bold text-foreground">{itemCount} items:</span> {previewNames}
                          {itemCount > 2 && '...'}
                        </td>

                        {/* Total Amount */}
                        <td className="px-4 py-3.5 text-right font-black text-sm text-foreground">
                          ₹{Number(bill.totalAmount || 0).toFixed(2)}
                        </td>

                        {/* PROFIT PER BILL */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <p className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                            +₹{pInfo.profit.toFixed(2)}
                          </p>
                          <span className="inline-block text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-200/60 dark:border-emerald-800/60">
                            {pInfo.margin}% Profit
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedBill(bill)}
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                              title="View Invoice Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => printThermalReceipt(bill)}
                              className="h-8 w-8 text-foreground hover:bg-muted rounded-lg"
                              title="Print Thermal Receipt"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => sendWhatsAppReceipt(bill)}
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg"
                              title="Share on WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={actionLoading === bill.id}
                              onClick={() => handleCancelBill(bill)}
                              className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                              title="Cancel Bill / Move to Recycle Bin"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (Shown on mobile devices) */}
            <div className="md:hidden divide-y divide-border/60">
              {filteredBills.map((bill) => {
                const cust = getBillCustomer(bill);
                const billShortId = String(bill.id || '').slice(-6).toUpperCase();
                const itemCount = bill.items?.length || 0;
                const previewNames = (bill.items || []).slice(0, 3).map(it => it.name).join(', ');
                const pInfo = getBillProfit(bill);

                return (
                  <div key={bill.id} className="p-3.5 space-y-2.5">
                    {/* Top Row: Invoice No, Mode & Date */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs bg-muted px-2 py-0.5 rounded-md text-foreground">
                          #{billShortId}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          bill.paymentMethod === 'cash' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                            : bill.paymentMethod === 'upi'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : bill.paymentMethod === 'udhar'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {bill.paymentMethod === 'cash' ? '💵 Cash' : bill.paymentMethod === 'upi' ? '📱 UPI' : bill.paymentMethod === 'udhar' ? '📕 Udhar' : bill.paymentMethod}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('en-IN') : ''}
                      </span>
                    </div>

                    {/* Customer & Items */}
                    <div className="space-y-1">
                      {cust.isKnown ? (
                        <p className="font-bold text-xs text-foreground flex items-center gap-1">
                          <User className="h-3 w-3 text-primary" />
                          <span>{cust.name}</span>
                          {cust.phone && <span className="font-mono text-muted-foreground text-[10px]">({cust.phone})</span>}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        <span className="font-semibold text-foreground">{itemCount} items:</span> {previewNames}
                      </p>
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-dashed border-border/70">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Bill Total:</p>
                        <p className="text-base font-black text-foreground leading-tight">
                          ₹{Number(bill.totalAmount || 0).toFixed(2)}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Profit:</p>
                        <span className="inline-block font-extrabold text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-300/50">
                          +₹{pInfo.profit.toFixed(0)} ({pInfo.margin}%)
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setSelectedBill(bill)}
                          className="h-8 w-8 rounded-lg text-blue-600"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => printThermalReceipt(bill)}
                          className="h-8 w-8 rounded-lg text-foreground"
                          title="Print"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => sendWhatsAppReceipt(bill)}
                          className="h-8 w-8 rounded-lg text-emerald-600"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Full Invoice Inspector Modal */}
      {selectedBill && (() => {
        const pInfo = getBillProfit(selectedBill);
        const cust = getBillCustomer(selectedBill);
        const billShortId = String(selectedBill.id || '').slice(-8).toUpperCase();

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto animate-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-foreground">
                      Invoice Details
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      #{billShortId}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedBill(null)}
                  className="h-8 w-8 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Bill Header Info Card */}
              <div className="grid grid-cols-2 gap-2.5 text-xs bg-muted/40 p-3.5 rounded-2xl border border-border/60">
                <div>
                  <p className="text-muted-foreground text-[11px]">Date & Time:</p>
                  <p className="font-bold text-foreground">
                    {selectedBill.createdAt ? new Date(selectedBill.createdAt).toLocaleString('en-IN') : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Payment Mode:</p>
                  <p className="font-black uppercase text-primary">
                    {selectedBill.paymentMethod}
                  </p>
                </div>
                {cust.isKnown && (
                  <div className="col-span-2 pt-2 border-t border-border/60 flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-[10px]">Customer Name:</p>
                      <p className="font-bold text-foreground flex items-center gap-1">
                        <User className="h-3 w-3 text-primary" /> {cust.name || 'Customer'}
                      </p>
                    </div>
                    {cust.phone && (
                      <div className="text-right">
                        <p className="text-muted-foreground text-[10px]">Mobile:</p>
                        <p className="font-mono font-bold text-foreground">+91 {cust.phone}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Package className="h-3.5 w-3.5 text-primary" /> Purchased Items (Item Breakdown):
                </p>
                <div className="border border-border/80 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/70 text-muted-foreground text-[10px] font-extrabold uppercase">
                      <tr>
                        <th className="px-3 py-2.5">Item</th>
                        <th className="px-2 py-2.5 text-center">Qty</th>
                        <th className="px-2 py-2.5 text-right">Cost Price</th>
                        <th className="px-3 py-2.5 text-right">Selling Price</th>
                        <th className="px-3 py-2.5 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {selectedBill.items?.map((it, idx) => {
                        const qty = Number(it.qty || 1);
                        const sp = Number(it.sellingPrice || 0);
                        let cp = Number((it as any).purchasePrice);
                        if (!cp || cp <= 0) {
                          const prod = (it.id && productMap.get(it.id)) || (it.name && productNameMap.get(it.name.trim().toLowerCase()));
                          if (prod && Number(prod.purchasePrice) > 0) cp = Number(prod.purchasePrice);
                        }
                        const itemProfit = (sp - (cp || 0)) * qty;

                        return (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-bold text-foreground">
                              {it.name}
                            </td>
                            <td className="px-2 py-2 text-center font-bold">{qty}</td>
                            <td className="px-2 py-2 text-right text-muted-foreground">
                              ₹{(cp || 0).toFixed(0)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              ₹{sp.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-black text-emerald-600 dark:text-emerald-400">
                              +₹{itemProfit.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PROFIT HIGHLIGHT CARD */}
              <div className="bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-teal-500/15 border-2 border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                      Net Profit from this Bill:
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total Cost: ₹{pInfo.cost.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    +₹{pInfo.profit.toFixed(2)}
                  </p>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                    {pInfo.margin}% Margin
                  </span>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-1.5 pt-2 border-t border-border/80 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>₹{Number(selectedBill.subtotal || selectedBill.totalAmount || 0).toFixed(2)}</span>
                </div>
                {Number(selectedBill.discountAmount) > 0 ? (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Discount:</span>
                    <span>-₹{Number(selectedBill.discountAmount).toFixed(2)}</span>
                  </div>
                ) : null}
                {Number(selectedBill.taxAmount) > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax (GST):</span>
                    <span>+₹{Number(selectedBill.taxAmount).toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-base font-black text-foreground pt-1.5 border-t">
                  <span>Grand Total:</span>
                  <span className="text-primary">₹{Number(selectedBill.totalAmount || 0).toFixed(2)}</span>
                </div>
                {Number(selectedBill.cashTendered || 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground pt-1 border-t border-dashed">
                    <span>Cash Tendered:</span>
                    <span className="font-semibold text-foreground">₹{Number(selectedBill.cashTendered).toFixed(2)}</span>
                  </div>
                )}
                {Number(selectedBill.changeReturn || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Change Return:</span>
                    <span>₹{Number(selectedBill.changeReturn).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-between gap-2.5 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printThermalReceipt(selectedBill)}
                  className="flex-1 text-xs font-bold h-10 rounded-xl"
                >
                  <Printer className="h-4 w-4 mr-1.5" /> Print Receipt
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => sendWhatsAppReceipt(selectedBill)}
                  className="flex-1 text-xs font-bold h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp Receipt
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}