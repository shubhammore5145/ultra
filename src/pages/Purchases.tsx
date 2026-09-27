import { useState, useEffect } from 'react';
import { 
  ShoppingCart, Printer, AlertTriangle, Loader2, Plus, 
  Building2, Receipt, Search, Trash, CheckCircle2, 
  Phone, MapPin, PackagePlus, Eye, X
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
      setProducts(prods);
      setSuppliers(supps);
      setPurchases(purchs);
      
      const lowStock = prods.filter((p: Product) => (p.stock || 0) <= (p.minStock || 0));
      setLowStockProducts(lowStock);
    } catch (err) {
      console.error('Failed to load purchases data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shopData?.shopId) {
      loadAllData();
    }
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <PackagePlus className="h-8 w-8 text-primary" /> Purchases & Stock-In (खरेदी)
          </h1>
          <p className="text-muted-foreground mt-1">
            Record supplier bills, automatically increase stock, and manage dealer udhar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'bills' && (
            <Button onClick={() => setShowBillModal(true)} className="bg-primary text-primary-foreground font-bold shadow-md">
              <Plus className="h-4 w-4 mr-2" /> New Purchase Bill (स्टॉक नोंद)
            </Button>
          )}
          {activeTab === 'suppliers' && (
            <Button onClick={() => {
              setSupplierForm({ id: '', name: '', phone: '', address: '', gstNumber: '', balance: 0 });
              setShowSupplierModal(true);
            }} className="bg-primary text-primary-foreground font-bold shadow-md">
              <Plus className="h-4 w-4 mr-2" /> Add Supplier (नवीन व्यापारी)
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

          {/* TAB 3: LOW STOCK SHOPPING LIST */}
          {activeTab === 'lowstock' && (
            <div className="space-y-4">
              {lowStockProducts.length === 0 ? (
                <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <h3 className="text-lg font-semibold">Your inventory is fully stocked!</h3>
                  <p>No products are currently below their minimum stock levels.</p>
                </div>
              ) : (
                <div className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden">
                  <div className="hidden print:block p-6 border-b text-center">
                    <h2 className="text-2xl font-bold">{shopData?.shopName || 'Kirana Store'} - Purchase Shopping List</h2>
                    <p className="text-muted-foreground">Generated on: {new Date().toLocaleDateString()}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                        <tr>
                          <th className="px-6 py-4">Product Name</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4 text-center">Current Stock</th>
                          <th className="px-6 py-4 text-center">Min Stock</th>
                          <th className="px-6 py-4">Qty to Buy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {lowStockProducts.map((product) => (
                          <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-4 font-medium flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-orange-500 print:hidden" /> {product.name}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">{product.category}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded font-bold text-xs">
                                {product.stock} {product.unit}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center text-muted-foreground">{product.minStock} {product.unit}</td>
                            <td className="px-6 py-4">
                              <div className="border-b-2 border-dashed border-gray-400 w-16 h-6 inline-block print:border-black"></div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                <PackagePlus className="h-6 w-6 text-primary" /> New Purchase Bill (स्टॉक खरेदी नोंद)
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowBillModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSavePurchaseBill} className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Supplier (व्यापारी)</label>
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
                    <label className="text-xs font-medium">Qty (संख्या)</label>
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
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Amount Paid (दिलेली रक्कम) ₹</label>
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
