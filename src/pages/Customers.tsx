import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, Loader2, Edit, Phone, MapPin, IndianRupee, MessageCircle, History, X, ShoppingCart } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Customer, Transaction } from '../types';

export default function Customers() {
  const { shopData } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // History State
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const [historySales, setHistorySales] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    balance: 0
  });

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
        await api.customers.update(editingId, formData);
        setCustomers(customers.map(c => c.id === editingId ? { ...c, ...formData } : c));
      } else {
        await api.customers.create({
          id: crypto.randomUUID(),
          ...formData,
          createdAt: new Date().toISOString()
        });
        // Reload customers
        const data = await api.customers.list();
        setCustomers(data);
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({ name: '', phone: '', address: '', balance: 0 });
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Failed to save customer');
    }
  };

  const handleEdit = (customer: Customer) => {
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      balance: customer.balance || 0
    });
    setEditingId(customer.id);
    setIsAdding(true);
  };

  const handleWhatsAppReminder = (customer: Customer) => {
    if (!shopData) return;
    const text = `Hello ${customer.name},\n\nThis is a gentle reminder from *${shopData.shopName || shopData.name || 'our shop'}*. Your pending udhar balance is *₹${Number(customer.balance || 0).toFixed(2)}*.\n\nPlease clear the dues at your earliest convenience. Thank you!`;
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/91${customer.phone}?text=${encodedText}`;
    window.open(url, '_blank');
  };

  const handleViewHistory = async (customer: Customer) => {
    if (!shopData?.shopId) return;
    setHistoryCustomerId(customer.id);
    setLoadingHistory(true);
    setHistorySales([]);

    try {
      const allSales = await api.transactions.list();
      const sales = allSales.filter((s: Transaction) => s.customerId === customer.id);
      
      // Sort by date descending (newest first)
      sales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistorySales(sales);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Customers
        </h1>
        <Button onClick={() => {
          setIsAdding(true);
          setEditingId(null);
          setFormData({ name: '', phone: '', address: '', balance: 0 });
        }}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      {isAdding && (
        <div className="bg-card text-card-foreground border rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Customer' : 'Add New Customer'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Name *</label>
                <Input 
                  required 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Rahul Sharma" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input 
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  placeholder="9876543210" 
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Address</label>
                <Input 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="House No, Area, City" 
                />
              </div>
              {!editingId && (
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Opening Balance (Udhar) ₹</label>
                  <Input 
                    type="number"
                    value={formData.balance}
                    onChange={e => setFormData({...formData, balance: Number(e.target.value)})}
                    placeholder="0" 
                  />
                  <p className="text-xs text-muted-foreground">Positive amount means they owe you money.</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button type="submit">Save Customer</Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-2 bg-card border rounded-lg p-2 shadow-sm">
        <Search className="h-5 w-5 text-muted-foreground ml-2" />
        <Input 
          className="border-0 shadow-none focus-visible:ring-0 text-base bg-transparent" 
          placeholder="Search customers by name or phone..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <p>No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Contact</th>
                  <th className="px-6 py-4 font-medium">Visits</th>
                  <th className="px-6 py-4 font-medium">Total Spent</th>
                  <th className="px-6 py-4 font-medium text-purple-600">Loyalty Points</th>
                  <th className="px-6 py-4 font-medium">Udhar Balance</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium">
                      {customer.name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center text-muted-foreground">
                          <Phone className="h-3 w-3 mr-1" /> {customer.phone || 'N/A'}
                        </span>
                        {customer.address && (
                          <span className="flex items-center text-muted-foreground text-xs">
                            <MapPin className="h-3 w-3 mr-1" /> {customer.address}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold">{customer.visits || 0}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-muted-foreground flex items-center">
                        <IndianRupee className="h-3 w-3 mr-1" />
                        {Number(customer.totalSpent || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-purple-600 flex items-center bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded w-fit">
                        ⭐ {customer.loyaltyPoints || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold flex items-center ${
                        customer.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        <IndianRupee className="h-3 w-3 mr-1" />
                        {Number(customer.balance || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {customer.balance > 0 && customer.phone && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                          onClick={() => handleWhatsAppReminder(customer)}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" /> Reminder
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleViewHistory(customer)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        <History className="h-4 w-4 mr-2" /> History
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(customer)}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History Modal */}
      {historyCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-card text-card-foreground p-0 rounded-2xl border shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="h-5 w-5" /> Customer History
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
                          <p className="font-bold text-sm">Bill #{sale.id.slice(-6).toUpperCase()}</p>
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
