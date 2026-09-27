import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Search, Loader2, IndianRupee, History, TrendingUp, TrendingDown, 
  MessageCircle, BookOpen, X, Printer, Phone, Calendar, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Customer } from '../types';

interface LedgerEntry {
  id: string;
  amount: number;
  type?: 'credit' | 'payment';
  notes?: string;
  paymentMethod?: string;
  items?: any;
  createdAt: string;
  entryType: 'sale' | 'udhar';
}

export default function Udhar() {
  const { shopData } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionType, setTransactionType] = useState<'credit' | 'payment'>('payment');
  const [processing, setProcessing] = useState(false);

  // Ledger / Statement Modal State
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchCustomers = async () => {
    try {
      const data = await api.customers.list();
      data.sort((a: Customer, b: Customer) => (b.balance || 0) - (a.balance || 0));
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shopData?.shopId) {
      fetchCustomers();
    }
  }, [shopData?.shopId]);

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.shopId || !selectedCustomer || !amount) return;

    setProcessing(true);
    try {
      const numAmount = Number(amount);

      await api.udhar.create({
        id: crypto.randomUUID(),
        customerId: selectedCustomer.id,
        amount: numAmount,
        type: transactionType,
        notes: notes || (transactionType === 'credit' ? 'Gave Udhar' : 'Received Payment')
      });
      
      await fetchCustomers();

      setAmount('');
      setNotes('');
      setSelectedCustomer(null);
      alert('Transaction recorded successfully!');
    } catch (error) {
      console.error('Error processing transaction:', error);
      alert('Failed to process transaction.');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenLedger = async (customer: Customer) => {
    setLedgerCustomer(customer);
    setLoadingLedger(true);
    setLedgerEntries([]);
    try {
      const data = await api.customers.getLedger(customer.id);
      setLedgerEntries(data);
    } catch (err) {
      console.error('Error fetching ledger', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleWhatsAppReminder = (customer: Customer) => {
    if (!customer.phone) {
      alert('Customer has no phone number.');
      return;
    }
    const shopName = shopData?.shopName || shopData?.name || 'our shop';
    const text = `Hello ${customer.name},\n\nThis is a gentle reminder from *${shopName}*. Your pending udhar balance is *₹${Number(customer.balance || 0).toFixed(2)}*.\n\nPlease clear the dues at your earliest convenience. Thank you!`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/91${customer.phone.replace(/\D/g, '').slice(-10)}?text=${encoded}`, '_blank');
  };

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  const totalUdhar = customers.reduce((sum, c) => sum + (Number(c.balance) > 0 ? Number(c.balance) : 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <History className="h-8 w-8 text-primary" /> Udhar Book (उधारी खातेवही)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track customer balances, send WhatsApp reminders, and view passbook statements.
          </p>
        </div>
        <div className="bg-orange-500/10 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 px-5 py-3 rounded-2xl border border-orange-500/20 shadow-sm flex items-center gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Market Udhar</p>
            <p className="text-3xl font-black flex items-center text-orange-600 dark:text-orange-400 mt-0.5">
              <IndianRupee className="h-6 w-6 mr-1" /> {totalUdhar.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Record Transaction Form */}
      {selectedCustomer && (
        <div className="bg-card text-card-foreground border-2 border-primary/40 rounded-2xl p-6 shadow-xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <div>
              <h2 className="text-xl font-bold">Record Transaction: {selectedCustomer.name}</h2>
              <p className="text-xs text-muted-foreground">{selectedCustomer.phone || 'No phone'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className={`text-xl font-black ${Number(selectedCustomer.balance) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                ₹{Number(selectedCustomer.balance || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <form onSubmit={handleTransaction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Transaction Type *</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={transactionType === 'payment' ? 'default' : 'outline'}
                    className={`flex-1 font-bold ${transactionType === 'payment' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                    onClick={() => setTransactionType('payment')}
                  >
                    <TrendingDown className="mr-2 h-4 w-4" /> Received Payment (जमा)
                  </Button>
                  <Button
                    type="button"
                    variant={transactionType === 'credit' ? 'default' : 'outline'}
                    className={`flex-1 font-bold ${transactionType === 'credit' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                    onClick={() => setTransactionType('credit')}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" /> Gave Udhar (नावे)
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Amount (रक्कम ₹) *</label>
                <Input 
                  required 
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount" 
                  className="text-lg font-bold"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Notes / Details (Optional)</label>
                <Input 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Paid via UPI, or Bought 5kg Atta & Oil" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setSelectedCustomer(null)}>Cancel</Button>
              <Button type="submit" disabled={processing} className="font-bold">
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Transaction
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search Input */}
      <div className="flex items-center gap-2 bg-card border rounded-xl p-2.5 shadow-sm max-w-md">
        <Search className="h-5 w-5 text-muted-foreground ml-2" />
        <Input 
          className="border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent" 
          placeholder="Search by customer name or phone..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-card border rounded-2xl p-8">
            <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="font-semibold">No customers found.</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{customer.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {customer.phone || 'No phone'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-xl ${Number(customer.balance) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      ₹{Number(customer.balance || 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Balance</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200"
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setTransactionType('payment');
                    }}
                  >
                    Receive Pay
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200"
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setTransactionType('credit');
                    }}
                  >
                    Give Udhar
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="flex-1 text-xs text-primary hover:bg-primary/10"
                    onClick={() => handleOpenLedger(customer)}
                  >
                    <BookOpen className="h-3.5 w-3.5 mr-1" /> Passbook Statement
                  </Button>
                  {customer.balance > 0 && customer.phone && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      onClick={() => handleWhatsAppReminder(customer)}
                      title="Send WhatsApp Reminder"
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> Reminder
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* PASSBOOK / LEDGER STATEMENT MODAL */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-muted/30">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" /> {ledgerCustomer.name} - Statement
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Phone: {ledgerCustomer.phone || 'N/A'} | Current Udhar Balance: <span className="font-bold text-red-500">₹{Number(ledgerCustomer.balance || 0).toFixed(2)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setLedgerCustomer(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {loadingLedger ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : ledgerEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No transactions recorded for this customer yet.</p>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-muted text-muted-foreground uppercase text-[10px] sm:text-xs">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Type / Description</th>
                        <th className="p-3 text-right">Debit (Udhar)</th>
                        <th className="p-3 text-right">Credit (Paid)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ledgerEntries.map((entry) => {
                        const isCreditPaid = entry.entryType === 'udhar' && entry.type === 'payment';
                        const isDebitUdhar = (entry.entryType === 'udhar' && entry.type === 'credit') || (entry.entryType === 'sale' && entry.paymentMethod === 'udhar');

                        return (
                          <tr key={entry.id} className="hover:bg-muted/30">
                            <td className="p-3 text-muted-foreground">
                              {new Date(entry.createdAt).toLocaleDateString('en-IN')}
                            </td>
                            <td className="p-3">
                              <span className="font-medium text-foreground block">
                                {entry.entryType === 'sale' ? `POS Bill #${entry.id.slice(-6).toUpperCase()}` : (entry.notes || 'Udhar Transaction')}
                              </span>
                              {entry.paymentMethod && <span className="text-[10px] text-muted-foreground uppercase">{entry.paymentMethod}</span>}
                            </td>
                            <td className="p-3 text-right font-bold text-red-600">
                              {isDebitUdhar ? `+₹${Number(entry.amount || 0).toFixed(2)}` : '-'}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-600">
                              {isCreditPaid ? `-₹${Number(entry.amount || 0).toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-muted/20 flex justify-between items-center text-sm font-semibold">
              <span>Closing Pending Balance:</span>
              <span className="text-red-500 font-extrabold text-base">₹{Number(ledgerCustomer.balance || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
