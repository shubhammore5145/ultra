import { useState, useEffect } from 'react';
import { 
  ShoppingCart, Printer, AlertTriangle, Loader2, Plus, 
  Building2, Receipt, Search, Trash, CheckCircle2, 
  Phone, MapPin, PackagePlus, Eye, X, MessageSquare, Sparkles, ArrowRight
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import type { Product } from '../types';

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  balance: number;
}

interface PurchaseItem {
  productId: string;
  name: string;
  qty: number;
  purchasePrice: number;
  total: number;
}

interface Purchase {
  id: string;
  supplierId: string;
  supplierName?: string;
  supplierPhone?: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  items: PurchaseItem[] | string;
  notes?: string;
  createdAt: string;
}

export default function Purchases() {
  const { shopData } = useAuth();
  const [activeTab, setActiveTab] = useState<'bills' | 'suppliers' | 'lowstock'>('bills');
  
  // Data State
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // New Purchase Bill Form State
  const [showBillModal, setShowBillModal] = useState(false);
  const [billSaving, setBillSaving] = useState(false);
  const [billSupplierId, setBillSupplierId] = useState('');
  const [billInvoiceNumber, setBillInvoiceNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billItems, setBillItems] = useState<PurchaseItem[]>([]);
  const [billPaidAmount, setBillPaidAmount] = useState('');
  const [billNotes, setBillNotes] = useState('');

  // Item selector in bill modal
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');

  // Supplier Form State
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    id: '',
    name: '',
    phone: '',
    address: '',
    gstNumber: '',
    balance: 0
  });

  // View Bill Details Modal
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);

  // Search Filter
  const [searchTerm, setSearchTerm] = useState('');

  const loadAllData = async () => {
    try {
      const [prods, supps, purchs] = await Promise.all([
        api.products.list(),
        api.suppliers.list(),
        api.purchases.list()
      ]);
      const safeProds = Array.isArray(prods) ? prods : [];
      setProducts(safeProds);
      setSuppliers(Array.isArray(supps) ? supps : []);
      setPurchases(Array.isArray(purchs) ? purchs : []);
      
      const lowStock = safeProds.filter((p: Product) => (p.stock || 0) <= (p.minStock || 0));
      setLowStockProducts(lowStock);
    } catch (err) {
      console.error('Failed to load purchases data', err);
      setProducts([]);
      setSuppliers([]);
      setPurchases([]);
      setLowStockProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [shopData?.shopId]);

  // Handle Product select in Bill form
  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    const p = products.find(prod => prod.id === prodId);
    if (p) {
      setItemPrice(p.purchasePrice ? p.purchasePrice.toString() : '');
    }
  };

  // Add Item to Bill
  const addItemToBill = () => {
    if (!selectedProductId) return;
    const p = products.find(prod => prod.id === selectedProductId);
    if (!p) return;

    const qty = parseFloat(itemQty) || 1;
    const price = parseFloat(itemPrice) || p.purchasePrice || 0;
    const total = qty * price;

    const existingIndex = billItems.findIndex(i => i.productId === selectedProductId);
    if (existingIndex > -1) {
      const updated = [...billItems];
      updated[existingIndex].qty += qty;
      updated[existingIndex].total = updated[existingIndex].qty * updated[existingIndex].purchasePrice;
      setBillItems(updated);
    } else {
      setBillItems([...billItems, {
        productId: p.id,
        name: p.name,
        qty,
        purchasePrice: price,
        total
      }]);
    }

    setSelectedProductId('');
    setItemQty('1');
    setItemPrice('');
  };

  const removeItemFromBill = (idx: number) => {
    setBillItems(billItems.filter((_, i) => i !== idx));
  };

  const billTotalAmount = billItems.reduce((sum, item) => sum + item.total, 0);

  // Save Purchase Bill
  const handleSavePurchaseBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (billItems.length === 0) {
      alert('Please add at least one product to the purchase bill.');
      return;
    }

    setBillSaving(true);
    try {
      const paid = billPaidAmount === '' ? billTotalAmount : parseFloat(billPaidAmount) || 0;
      let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'paid';
      if (paid <= 0) paymentStatus = 'unpaid';
      else if (paid < billTotalAmount) paymentStatus = 'partial';

      await api.purchases.create({
        supplierId: billSupplierId || null,
        invoiceNumber: billInvoiceNumber,
        date: billDate,
        totalAmount: billTotalAmount,
        paidAmount: paid,
        paymentStatus,
        items: billItems,
        notes: billNotes
      });

      alert('🎉 Purchase bill saved and inventory stock automatically increased!');
      setShowBillModal(false);
      setBillItems([]);
      setBillSupplierId('');
      setBillInvoiceNumber('');
      setBillPaidAmount('');
      setBillNotes('');
      await loadAllData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to save purchase bill.');
    } finally {
      setBillSaving(false);
    }
  };

  // Save Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierSaving(true);
    try {
      if (supplierForm.id) {
        await api.suppliers.update(supplierForm.id, supplierForm);
      } else {
        await api.suppliers.create(supplierForm);
      }
      alert('Supplier saved successfully!');
      setShowSupplierModal(false);
      setSupplierForm({ id: '', name: '', phone: '', address: '', gstNumber: '', balance: 0 });
      await loadAllData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to save supplier.');
    } finally {
      setSupplierSaving(false);
    }
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete supplier "${name}"?`)) {
      try {
        await api.suppliers.delete(id);
        await loadAllData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete supplier.');
      }
    }
  };

  const createBillFromItem = (product: Product, qty: number) => {
    const price = product.purchasePrice || 0;
    setBillItems([{
      productId: product.id,
      name: product.name,
      qty: qty,
      purchasePrice: price,
      total: qty * price
    }]);
    setBillInvoiceNumber(`PO-${Date.now().toString().slice(-6)}`);
    setShowBillModal(true);
  };

  const restockAllLowStock = () => {
    const items: PurchaseItem[] = lowStockProducts.map(p => {
      const qty = p.reorderQty || Math.max(10, ((p.minStock || 5) * 2) - Math.floor(p.stock || 0));
      const price = p.purchasePrice || 0;
      return {
        productId: p.id,
        name: p.name,
        qty,
        purchasePrice: price,
        total: qty * price
      };
    });
    setBillItems(items);
    setBillInvoiceNumber(`PO-${Date.now().toString().slice(-6)}`);
    setShowBillModal(true);
  };

  const sendWhatsAppPO = (product: Product, qty: number) => {
    const shopName = shopData?.shopName || 'Nayashi Kirana';
    const text = `*📦 Purchase Order from ${shopName}*\n\n` +
      `*Item:* ${product.name}\n` +
      `*Quantity Needed:* ${qty} ${product.unit || 'pcs'}\n` +
      `*Current Stock:* ${product.stock || 0}\n` +
      `*Date:* ${new Date().toLocaleDateString()}\n\n` +
      `Please confirm dispatch and delivery time. Thank you!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const sendAllWhatsAppPO = () => {
    const shopName = shopData?.shopName || 'Nayashi Kirana';
    let text = `*📦 Bulk Purchase Order from ${shopName}*\n` +
      `*Date:* ${new Date().toLocaleDateString()}\n\n` +
      `*Items to Restock:*\n`;
    lowStockProducts.forEach((p, idx) => {
      const qty = p.reorderQty || Math.max(10, ((p.minStock || 5) * 2) - Math.floor(p.stock || 0));
      text += `${idx + 1}. *${p.name}* — ${qty} ${p.unit || 'pcs'}\n`;
    });
    text += `\nPlease confirm availability and rate quote. Thank you!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <PackagePlus className="h-8 w-8 text-primary" /> Purchases & Stock-In
          </h1>
          <p className="text-muted-foreground mt-1">
            Record supplier bills, automatically increase stock, and manage dealer udhar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'bills' && (
            <Button onClick={() => setShowBillModal(true)} className="bg-primary text-primary-foreground font-bold shadow-md">
              <Plus className="h-4 w-4 mr-2" /> New Purchase Bill
            </Button>
          )}
          {activeTab === 'suppliers' && (
            <Button onClick={() => {
              setSupplierForm({ id: '', name: '', phone: '', address: '', gstNumber: '', balance: 0 });
              setShowSupplierModal(true);
            }} className="bg-primary text-primary-foreground font-bold shadow-md">
              <Plus className="h-4 w-4 mr-2" /> Add Supplier
            </Button>
          )}
          {activeTab === 'lowstock' && (
            <Button onClick={() => window.print()} disabled={lowStockProducts.length === 0} className="font-bold">
              <Printer className="h-4 w-4 mr-2" /> Print Order List
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2 print:hidden">
        <button
          onClick={() => setActiveTab('bills')}
          className={`pb-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'bills'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Receipt className="h-4 w-4" /> Purchase Bills ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'suppliers'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4" /> Suppliers / Dealers ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab('lowstock')}
          className={`pb-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'lowstock'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle className="h-4 w-4 text-orange-500" /> Low Stock Shopping List ({lowStockProducts.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* TAB 1: PURCHASE BILLS (STOCK-IN) */}
          {activeTab === 'bills' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-card border rounded-lg p-2 shadow-sm max-w-md">
                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                <Input
                  className="border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent"
                  placeholder="Search bills by invoice or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold border-b">
                      <tr>
                        <th className="px-6 py-4">Invoice / Date</th>
                        <th className="px-6 py-4">Supplier</th>
                        <th className="px-6 py-4 text-right">Total Amount</th>
                        <th className="px-6 py-4 text-right">Paid</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {purchases.filter(p => 
                        (p.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase())
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p className="font-medium">No purchase bills recorded yet.</p>
                            <p className="text-xs mt-1">Click "New Purchase Bill" to add incoming stock from suppliers.</p>
                          </td>
                        </tr>
                      ) : (
                        purchases.filter(p => 
                          (p.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase())
                        ).map((purchase) => (
                          <tr key={purchase.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-foreground">{purchase.invoiceNumber || 'No Invoice #'}</p>
                              <p className="text-xs text-muted-foreground">{new Date(purchase.date).toLocaleDateString('en-IN')}</p>
                            </td>
                            <td className="px-6 py-4 font-medium">
                              {purchase.supplierName || <span className="text-muted-foreground italic">Direct Purchase</span>}
                              {purchase.supplierPhone && <p className="text-xs text-muted-foreground">{purchase.supplierPhone}</p>}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-foreground">
                              ₹{Number(purchase.totalAmount || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right text-emerald-600 font-semibold">
                              ₹{Number(purchase.paidAmount || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                purchase.paymentStatus === 'paid' 
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : purchase.paymentStatus === 'partial'
                                  ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                  : 'bg-red-500/10 text-red-600 border border-red-500/20'
                              }`}>
                                {purchase.paymentStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button variant="ghost" size="sm" onClick={() => setViewingPurchase(purchase)}>
                                <Eye className="h-4 w-4 mr-1" /> View Items
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SUPPLIERS */}
          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {suppliers.length === 0 ? (
                  <div className="col-span-full bg-card border rounded-xl p-12 text-center text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <h3 className="text-lg font-bold">No Suppliers Added Yet</h3>
                    <p className="text-sm mt-1">Add your distributors and wholesalers to track who you buy stock from.</p>
                  </div>
                ) : (
                  suppliers.map((supplier) => (
                    <div key={supplier.id} className="bg-card border rounded-xl p-5 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-lg text-foreground">{supplier.name}</h3>
                          {supplier.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Phone className="h-3.5 w-3.5" /> {supplier.phone}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-bold block ${Number(supplier.balance) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            ₹{Number(supplier.balance || 0).toFixed(2)}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending Payable</span>
                        </div>
                      </div>

                      {supplier.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {supplier.address}
                        </p>
                      )}
                      {supplier.gstNumber && (
                        <p className="text-xs text-muted-foreground font-mono">
                          GST: {supplier.gstNumber}
                        </p>
                      )}

                      <div className="pt-2 border-t flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSupplierForm({
                              id: supplier.id,
                              name: supplier.name,
                              phone: supplier.phone || '',
                              address: supplier.address || '',
                              gstNumber: supplier.gstNumber || '',
                              balance: supplier.balance || 0
                            });
                            setShowSupplierModal(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: D-MART AUTOMATIC REORDER & REPLENISHMENT PLANNER */}
          {activeTab === 'lowstock' && (
            <div className="space-y-4">
              {lowStockProducts.length === 0 ? (
                <div className="bg-card border rounded-2xl p-12 text-center text-muted-foreground shadow-xs">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">सर्व स्टॉक व्यवस्थित आहे! (Fully Stocked)</h3>
                  <p className="text-sm mt-1 max-w-md mx-auto">
                    कोणत्याही उत्पादनाचा स्टॉक किमान मर्यादेच्या (Min Stock Alert) खाली गेलेला नाही.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Top D-Mart Action & Metric Bar */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
                    <div className="bg-card border rounded-xl p-4 shadow-xs">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Restock Required</span>
                      <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                        {lowStockProducts.length} Items
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Below safe replenishment threshold</p>
                    </div>

                    <div className="bg-card border rounded-xl p-4 shadow-xs">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est. Restock Capital</span>
                      <p className="text-2xl font-black text-foreground mt-1">
                        ₹{lowStockProducts.reduce((sum, p) => {
                          const qty = p.reorderQty || Math.max(10, ((p.minStock || 5) * 2) - Math.floor(p.stock || 0));
                          return sum + (qty * (p.purchasePrice || 0));
                        }, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">At wholesale cost price</p>
                    </div>

                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 shadow-xs flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5" /> 1-Click Multi Restock
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          सर्व {lowStockProducts.length} वस्तू थेट खरेदी बिलामध्ये (PO) जोडा
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={restockAllLowStock} 
                        className="mt-2 font-bold w-full bg-primary text-primary-foreground shadow-xs"
                      >
                        <PackagePlus className="h-3.5 w-3.5 mr-1.5" /> Restock All to Bill
                      </Button>
                    </div>

                    <div className="bg-card border rounded-xl p-4 shadow-xs flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground">Supplier WhatsApp PO</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          सप्लायर/डीलरला एका क्लिकवर खरेदी यादी व्हॉट्सॲपवर पाठवा
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={sendAllWhatsAppPO} 
                        className="mt-2 font-semibold w-full text-emerald-600 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> WhatsApp All Items
                      </Button>
                    </div>
                  </div>

                  {/* Replenishment Table */}
                  <div className="bg-card text-card-foreground border rounded-xl shadow-xs overflow-hidden">
                    <div className="hidden print:block p-6 border-b text-center">
                      <h2 className="text-2xl font-bold">{shopData?.shopName || 'Nayashi Kirana'} - Purchase Reorder Sheet</h2>
                      <p className="text-muted-foreground">Generated on: {new Date().toLocaleDateString()}</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/60 text-muted-foreground text-xs uppercase font-bold tracking-wider border-b">
                          <tr>
                            <th className="px-5 py-3.5">Product & Placement</th>
                            <th className="px-4 py-3.5 text-center">Current Stock</th>
                            <th className="px-4 py-3.5 text-center">Min Alert</th>
                            <th className="px-4 py-3.5 text-center">Suggested Reorder</th>
                            <th className="px-4 py-3.5 text-right">Unit Cost</th>
                            <th className="px-4 py-3.5 text-right">Est. Total</th>
                            <th className="px-5 py-3.5 text-right print:hidden">Replenish Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {lowStockProducts.map((product) => {
                            const isOut = (product.stock || 0) <= 0;
                            const suggestedQty = product.reorderQty || Math.max(10, ((product.minStock || 5) * 2) - Math.floor(product.stock || 0));
                            const unitCost = product.purchasePrice || 0;
                            const estTotal = suggestedQty * unitCost;

                            return (
                              <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-start gap-2.5">
                                    <div className={`mt-0.5 p-1 rounded-md ${isOut ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                      <AlertTriangle className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-foreground leading-snug">{product.name}</p>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                        <span className="bg-muted px-1.5 py-0.5 rounded font-medium">{product.category || 'General'}</span>
                                        {product.rackLocation && (
                                          <span className="bg-blue-500/10 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono font-medium">
                                            📍 {product.rackLocation}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-4 py-3.5 text-center">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full font-black text-xs ${
                                    isOut 
                                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400 border border-red-300 dark:border-red-800' 
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                                  }`}>
                                    {product.stock || 0} {product.unit || 'pcs'}
                                  </span>
                                </td>

                                <td className="px-4 py-3.5 text-center text-xs font-semibold text-muted-foreground">
                                  {product.minStock || 5} {product.unit || 'pcs'}
                                </td>

                                <td className="px-4 py-3.5 text-center">
                                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg font-black text-sm border border-emerald-500/20">
                                    {suggestedQty} {product.unit || 'pcs'}
                                    {product.reorderQty ? (
                                      <span className="text-[10px] font-semibold opacity-75">(D-Mart)</span>
                                    ) : null}
                                  </span>
                                </td>

                                <td className="px-4 py-3.5 text-right font-medium text-xs">
                                  ₹{unitCost.toFixed(2)}
                                </td>

                                <td className="px-4 py-3.5 text-right font-bold text-sm text-foreground">
                                  ₹{estTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </td>

                                <td className="px-5 py-3.5 text-right print:hidden">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => sendWhatsAppPO(product, suggestedQty)}
                                      className="h-8 px-2.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                      title="Send WhatsApp PO to supplier"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
                                    </Button>

                                    <Button
                                      size="sm"
                                      onClick={() => createBillFromItem(product, suggestedQty)}
                                      className="h-8 px-3 text-xs font-bold bg-primary text-primary-foreground shadow-xs"
                                    >
                                      <Plus className="h-3.5 w-3.5 mr-1" /> Add to Bill
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* NEW PURCHASE BILL MODAL */}
      {showBillModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <PackagePlus className="h-6 w-6 text-primary" /> New Purchase Bill
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowBillModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSavePurchaseBill} className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Supplier</label>
                  <select
                    value={billSupplierId}
                    onChange={(e) => setBillSupplierId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Direct / Cash Wholesaler</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Invoice / Bill No.</label>
                  <Input
                    placeholder="e.g. INV-2026-089"
                    value={billInvoiceNumber}
                    onChange={(e) => setBillInvoiceNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Bill Date</label>
                  <Input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Add Item Row */}
              <div className="p-4 border rounded-xl bg-muted/20 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Add Products to Bill</h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-xs font-medium">Select Product</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Current Stock: {p.stock} {p.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-xs font-medium">Purchase Rate (₹)</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Rate"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-medium">Qty</label>
                    <Input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="button" onClick={addItemToBill} className="w-full" disabled={!selectedProductId}>
                      Add Item
                    </Button>
                  </div>
                </div>
              </div>

              {/* Items List Table */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs uppercase font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Product</th>
                      <th className="px-4 py-2 text-right">Rate</th>
                      <th className="px-4 py-2 text-center">Qty</th>
                      <th className="px-4 py-2 text-right">Subtotal</th>
                      <th className="px-4 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {billItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                          No items added yet. Select a product above.
                        </td>
                      </tr>
                    ) : (
                      billItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 font-medium">{item.name}</td>
                          <td className="px-4 py-2 text-right">₹{item.purchasePrice.toFixed(2)}</td>
                          <td className="px-4 py-2 text-center font-bold text-primary">+{item.qty}</td>
                          <td className="px-4 py-2 text-right font-medium">₹{item.total.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeItemFromBill(idx)}>
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {billItems.length > 0 && (
                    <tfoot className="bg-muted/50 font-bold border-t">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right">Total Bill Amount:</td>
                        <td className="px-4 py-3 text-right text-lg text-primary">₹{billTotalAmount.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Amount Paid (₹)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={`Full (₹${billTotalAmount.toFixed(2)})`}
                    value={billPaidAmount}
                    onChange={(e) => setBillPaidAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Remaining unpaid amount will be added to Supplier's pending balance.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Notes / Remarks</label>
                  <Input
                    placeholder="e.g. Paid via PhonePe or Cheque"
                    value={billNotes}
                    onChange={(e) => setBillNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t pt-4 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowBillModal(false)}>Cancel</Button>
                <Button type="submit" disabled={billSaving || billItems.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  {billSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Save Bill & Increase Stock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER MODAL */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> {supplierForm.id ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowSupplierModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Supplier / Agency Name *</label>
                <Input
                  required
                  placeholder="e.g. Shrinath Trading Co."
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Contact Phone</label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Address / City</label>
                <Input
                  placeholder="e.g. APMC Market, Shop 12"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">GST Number (Optional)</label>
                <Input
                  placeholder="GSTIN"
                  value={supplierForm.gstNumber}
                  onChange={(e) => setSupplierForm({ ...supplierForm, gstNumber: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowSupplierModal(false)}>Cancel</Button>
                <Button type="submit" disabled={supplierSaving}>
                  {supplierSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Supplier'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PURCHASE MODAL */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl w-full max-w-lg p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <h3 className="font-bold text-lg">Bill: {viewingPurchase.invoiceNumber || 'No Invoice'}</h3>
                <p className="text-xs text-muted-foreground">{new Date(viewingPurchase.date).toLocaleDateString('en-IN')}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setViewingPurchase(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Supplier:</span>
                <span className="font-semibold">{viewingPurchase.supplierName || 'Direct Cash'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Bill:</span>
                <span className="font-bold">₹{Number(viewingPurchase.totalAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid Amount:</span>
                <span className="font-bold text-emerald-600">₹{Number(viewingPurchase.paidAmount || 0).toFixed(2)}</span>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2">Purchased Items</h4>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Item</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(() => {
                      let itemsArr: PurchaseItem[] = [];
                      if (typeof viewingPurchase.items === 'string') {
                        try { itemsArr = JSON.parse(viewingPurchase.items); } catch(e) {}
                      } else if (Array.isArray(viewingPurchase.items)) {
                        itemsArr = viewingPurchase.items;
                      }
                      return itemsArr.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2">{it.name}</td>
                          <td className="p-2 text-right">₹{Number(it.purchasePrice || 0).toFixed(2)}</td>
                          <td className="p-2 text-center font-bold text-primary">+{it.qty}</td>
                          <td className="p-2 text-right font-semibold">₹{Number(it.total || 0).toFixed(2)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setViewingPurchase(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
