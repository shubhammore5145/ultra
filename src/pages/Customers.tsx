import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Plus, Search, Loader2, Edit, Phone, MapPin, 
  IndianRupee, MessageCircle, History, X, ShoppingCart, 
  CreditCard, Camera, Eye, ShieldCheck, AlertTriangle, Trash2 
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../lib/imageCompressor';
import type { Customer, Transaction } from '../types';

export default function Customers() {
  const { shopData } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Lightbox for Aadhaar / Customer Photo Preview
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<{ title: string; url: string } | null>(null);

  // History State
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const [historySales, setHistorySales] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    balance: 0,
    aadharNumber: '',
    photoUrl: '',
    aadharPhotoUrl: ''
  });

  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const data = await api.customers.list();
        const safeData = Array.isArray(data) ? [...data] : [];
        safeData.sort((a: Customer, b: Customer) => a.name.localeCompare(b.name));
        setCustomers(safeData);
      } catch (err) {
        console.error('Failed to load customers', err);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCustomers();
  }, [shopData?.shopId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.shopId) return;

    try {
      if (editingId) {
        await api.customers.update(editingId, { shopId: shopData.shopId, ...formData });
        setCustomers(customers.map(c => c.id === editingId ? { ...c, ...formData } : c));
      } else {
        await api.customers.create({
          id: crypto.randomUUID(),
          shopId: shopData.shopId,
          ...formData,
          createdAt: new Date().toISOString()
        });
        // Reload customers
        const data = await api.customers.list();
        setCustomers(data);
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({ 
        name: '', 
        phone: '', 
        address: '', 
        balance: 0, 
        aadharNumber: '', 
        photoUrl: '', 
        aadharPhotoUrl: '' 
      });
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Failed to save customer details.');
    }
  };

  const handleEdit = (customer: Customer) => {
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      balance: customer.balance || 0,
      aadharNumber: customer.aadharNumber || '',
      photoUrl: customer.photoUrl || '',
      aadharPhotoUrl: customer.aadharPhotoUrl || ''
    });
    setEditingId(customer.id);
    setIsAdding(true);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'photoUrl' | 'aadharPhotoUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const compressed = await compressImage(file, 900, 900, 0.75);
      setFormData(prev => ({ ...prev, [field]: compressed }));
    } catch (err) {
      console.error('Failed to compress image:', err);
      alert('Failed to process image. Please try another photo.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleWhatsAppReminder = (customer: Customer) => {
    if (!shopData) return;
    const text = `Hello ${customer.name},\n\nThis is a gentle reminder from *${shopData.shopName || shopData.name || 'our shop'}*. Your pending Udhar balance is *₹${Number(customer.balance || 0).toFixed(2)}*.\n\nPlease clear the balance at your earliest convenience. Thank you!`;
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/91${customer.phone}?text=${encodedText}`;
    window.open(url, '_blank');
  };

  const handleViewHistory = async (customer: Customer) => {
    setHistoryCustomerId(customer.id);
    setLoadingHistory(true);
    setHistorySales([]);

    try {
      const allSales = await api.transactions.list();
      const sales = allSales.filter((s: Transaction) => s.customerId === customer.id);
      sales.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistorySales(sales);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (Number(customer.balance || 0) > 0) {
      if (!window.confirm(`Warning: ${customer.name} has a pending Udhar balance of ₹${customer.balance}. Are you sure you want to move this account to Recycle Bin?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to move ${customer.name} to the Recycle Bin? You can restore it anytime.`)) {
        return;
      }
    }

    try {
      await api.customers.delete(customer.id, customer);
      setCustomers(prev => prev.filter(c => c.id !== customer.id));
    } catch (err: any) {
      alert('Failed to delete customer: ' + (err.message || 'Error'));
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone || '').includes(searchTerm) ||
    (c.aadharNumber || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Customer Directory & Udhar ID</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage customer profiles, loyalty points, Udhar balances, and Aadhaar card identity records.
          </p>
        </div>
        <Button onClick={() => {
          setEditingId(null);
          setFormData({ name: '', phone: '', address: '', balance: 0, aadharNumber: '', photoUrl: '', aadharPhotoUrl: '' });
          setIsAdding(true);
        }}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      {/* Add / Edit Customer Form Modal or Panel */}
      {isAdding && (
        <div className="bg-card text-card-foreground border rounded-2xl p-6 shadow-lg animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <h2 className="text-xl font-bold">{editingId ? 'Edit Customer & ID Details' : 'Add New Customer Profile'}</h2>
            <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Full Name *</label>
                <Input 
                  required 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Ramesh Patil" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mobile Phone (10 digits)</label>
                <Input 
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  placeholder="9876543210" 
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Address / Landmark</label>
                <Input 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="Lane No, Village / Area, Pincode" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Aadhaar Card Number (12 Digits)</label>
                <Input 
                  maxLength={14}
                  value={formData.aadharNumber}
                  onChange={e => setFormData({...formData, aadharNumber: e.target.value})}
                  placeholder="XXXX XXXX XXXX" 
                />
              </div>

              {!editingId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Opening Balance (Udhar Credit) ₹</label>
                  <Input 
                    type="number"
                    value={formData.balance}
                    onChange={e => setFormData({...formData, balance: Number(e.target.value)})}
                    placeholder="0" 
                  />
                </div>
              )}
            </div>

            {/* Document Uploads: Customer Photo + Aadhaar Card Photo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
              {/* Customer Photo */}
              <div className="border border-dashed rounded-xl p-4 flex flex-col items-center justify-center bg-muted/20 text-center">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-foreground">
                  <Camera className="h-4 w-4 text-primary" /> Customer Photo
                </p>
                {formData.photoUrl ? (
                  <div className="relative group">
                    <img 
                      src={formData.photoUrl} 
                      alt="Customer" 
                      className="h-28 w-28 object-cover rounded-xl border-2 border-primary shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, photoUrl: '' }))}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="user" 
                      className="hidden" 
                      onChange={e => handleFileUpload(e, 'photoUrl')} 
                    />
                    <div className="px-3 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5" /> Capture / Upload Photo
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">Auto-compressed under 100 KB</span>
                  </label>
                )}
              </div>

              {/* Aadhaar Card Photo */}
              <div className="border border-dashed rounded-xl p-4 flex flex-col items-center justify-center bg-muted/20 text-center">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-foreground">
                  <CreditCard className="h-4 w-4 text-emerald-600" /> Aadhaar Card Photo
                </p>
                {formData.aadharPhotoUrl ? (
                  <div className="relative group">
                    <img 
                      src={formData.aadharPhotoUrl} 
                      alt="Aadhaar Card" 
                      className="h-28 w-44 object-cover rounded-xl border-2 border-emerald-500 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, aadharPhotoUrl: '' }))}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={e => handleFileUpload(e, 'aadharPhotoUrl')} 
                    />
                    <div className="px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" /> Capture / Upload Aadhaar
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">Essential proof for high-limit Udhar</span>
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button type="submit" disabled={uploadingImage}>
                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Customer Record
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-2 bg-card border rounded-xl p-2.5 shadow-sm">
        <Search className="h-5 w-5 text-muted-foreground ml-2" />
        <Input 
          className="border-0 shadow-none focus-visible:ring-0 text-base bg-transparent" 
          placeholder="Search by customer name, phone number, or Aadhaar number..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Customers Table */}
      <div className="bg-card text-card-foreground border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <p>No customers found matching your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold">Customer</th>
                  <th className="px-6 py-4 font-semibold">Contact & Address</th>
                  <th className="px-6 py-4 font-semibold">Aadhaar & Identity</th>
                  <th className="px-6 py-4 font-semibold">Total Spent</th>
                  <th className="px-6 py-4 font-semibold">Loyalty</th>
                  <th className="px-6 py-4 font-semibold">Udhar Balance</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map((customer) => {
                  const hasUdhar = Number(customer.balance || 0) > 0;

                  return (
                    <tr key={customer.id} className="hover:bg-muted/40 transition-colors">
                      {/* Customer Name & Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {customer.photoUrl ? (
                            <img 
                              src={customer.photoUrl} 
                              alt={customer.name} 
                              onClick={() => setPreviewPhotoUrl({ title: `${customer.name}'s Photo`, url: customer.photoUrl! })}
                              className="h-10 w-10 rounded-full object-cover border-2 border-primary/40 cursor-pointer hover:scale-105 transition-transform" 
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                              {customer.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-foreground block">{customer.name}</span>
                            <span className="text-xs text-muted-foreground">{customer.visits || 0} visits</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Address */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="flex items-center text-foreground font-medium">
                            <Phone className="h-3 w-3 mr-1 text-muted-foreground" /> {customer.phone || 'No phone'}
                          </span>
                          {customer.address && (
                            <span className="flex items-center text-muted-foreground truncate max-w-[200px]" title={customer.address}>
                              <MapPin className="h-3 w-3 mr-1 shrink-0" /> {customer.address}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Aadhaar Card Proof Section */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          {customer.aadharPhotoUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl({ 
                                title: `Aadhaar Card: ${customer.name}`, 
                                url: customer.aadharPhotoUrl! 
                              })}
                              className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-all cursor-pointer shadow-xs"
                            >
                              <img 
                                src={customer.aadharPhotoUrl} 
                                alt="Aadhaar" 
                                className="h-7 w-11 object-cover rounded border border-emerald-400 group-hover:scale-105 transition-transform"
                              />
                              <div className="text-left leading-tight">
                                <span className="text-[11px] font-bold flex items-center gap-1">
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Aadhaar Card
                                </span>
                                <span className="text-[10px] text-emerald-600/80 underline flex items-center gap-0.5">
                                  <Eye className="h-3 w-3" /> View Photo
                                </span>
                              </div>
                            </button>
                          ) : (
                            <span className={`text-[11px] px-2 py-0.5 rounded flex items-center gap-1 font-medium ${
                              hasUdhar 
                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300' 
                                : 'text-muted-foreground'
                            }`}>
                              {hasUdhar ? <AlertTriangle className="h-3 w-3 text-amber-600" /> : null}
                              {customer.aadharNumber ? `No Card Photo (${customer.aadharNumber.slice(-4)})` : 'No Aadhaar Saved'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Spent */}
                      <td className="px-6 py-4 font-medium">
                        <span className="flex items-center text-muted-foreground">
                          <IndianRupee className="h-3.5 w-3.5 mr-0.5" />
                          {Number(customer.totalSpent || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Loyalty */}
                      <td className="px-6 py-4">
                        <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-full w-fit text-xs">
                          ⭐ {customer.loyaltyPoints || 0}
                        </span>
                      </td>

                      {/* Udhar Balance */}
                      <td className="px-6 py-4">
                        <span className={`font-black flex items-center text-base ${
                          hasUdhar ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          <IndianRupee className="h-4 w-4 mr-0.5" />
                          {Number(customer.balance || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right space-x-2">
                        {hasUdhar && customer.phone && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                            onClick={() => handleWhatsAppReminder(customer)}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" /> Reminder
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleViewHistory(customer)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <History className="h-4 w-4 mr-1.5" /> History
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(customer)}>
                          <Edit className="h-4 w-4 mr-1.5" /> Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteCustomer(customer)} 
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Move to Recycle Bin"
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox / Fullscreen Preview Modal for Aadhaar / Customer Photo */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground p-0 rounded-2xl border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-muted/40">
              <h3 className="font-bold text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                {previewPhotoUrl.title}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setPreviewPhotoUrl(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4 flex justify-center bg-black/5 dark:bg-black/40">
              <img 
                src={previewPhotoUrl.url} 
                alt="Document Preview" 
                className="max-h-[70vh] w-auto object-contain rounded-lg border shadow-md"
              />
            </div>
            <div className="p-3 border-t bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
              <span>✓ Verified customer identity document</span>
              <Button size="sm" variant="outline" onClick={() => setPreviewPhotoUrl(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Past Purchase History Modal */}
      {historyCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-card text-card-foreground p-0 rounded-2xl border shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Customer Purchase History
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setHistoryCustomerId(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-muted/10">
              {loadingHistory ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : historySales.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No past bills found for this customer.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historySales.map(sale => (
                    <div key={sale.id} className="bg-background border rounded-xl p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-3 border-b pb-3">
                        <div>
                          <p className="font-bold text-sm">Invoice #{sale.id.slice(-6).toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary flex items-center justify-end">
                            <IndianRupee className="h-3 w-3 mr-1" /> {Number(sale.totalAmount || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase">{sale.paymentMethod}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.name} <span className="text-xs opacity-70">x{item.qty}</span></span>
                            <span>₹{((item.sellingPrice || 0) * item.qty).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
