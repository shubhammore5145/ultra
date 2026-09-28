import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Search, Loader2, IndianRupee, History, TrendingUp, TrendingDown, 
  MessageCircle, BookOpen, X, Printer, Phone,
  CheckCircle2, Send, ShieldCheck
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
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
  const { canAccess, requireFeature } = usePlan();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionType, setTransactionType] = useState<'credit' | 'payment'>('payment');
  const [processing, setProcessing] = useState(false);

  // Bulk WhatsApp Reminder State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<{
    sent: number;
    failed: number;
    total: number;
    completed?: boolean;
    error?: string;
  } | null>(null);
  const [botConnected, setBotConnected] = useState<boolean | null>(null);

  // Ledger / Statement Modal State
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [previewAadhaar, setPreviewAadhaar] = useState<{ title: string; url: string } | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await api.customers.list();
      const safeData = Array.isArray(data) ? [...data] : [];
      safeData.sort((a: Customer, b: Customer) => (b.balance || 0) - (a.balance || 0));
      setCustomers(safeData);
    } catch (err) {
      console.error('Failed to load customers', err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
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

  const handleWhatsAppReminder = async (customer: Customer) => {
    if (!requireFeature('whatsapp_reminders')) return;
    if (!customer.phone) {
      alert('ग्राहकाचा फोन नंबर उपलब्ध नाही.');
      return;
    }
    const cleanPh = customer.phone.replace(/\D/g, '').slice(-10);
    const shopName = shopData?.shopName || shopData?.name || 'आमच्या दुकानातून';
    const text = `🙏 *नमस्ते ${customer.name} जी,*\n\n*${shopName}* कडून नम्र आठवण:\nआपल्याकडे उधारी बाकी: *₹${Number(customer.balance || 0).toFixed(2)}* आहे.\n\nकृपया सवडीनुसार रक्कम जमा करावी ही विनंती. काही अडचण असल्यास संपर्क साधावा.\n\nधन्यवाद! 💐`;

    // Try direct WhatsApp Bot sending first
    try {
      const statusRes = await api.whatsapp.status();
      if (statusRes.status === 'CONNECTED' || statusRes.status === 'AUTHENTICATED') {
        await api.whatsapp.send(cleanPh, text);
        alert(`✅ ${customer.name} यांना WhatsApp उधारी आठवण मेसेज पाठवला!`);
        return;
      }
    } catch (e) {
      console.warn('Bot not available, falling back to manual wa.me');
    }

    // Fallback to wa.me
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/91${cleanPh}?text=${encoded}`, '_blank');
  };

  const pendingCustomers = customers.filter(c => Number(c.balance || 0) > 0);

  const handleOpenBulkModal = async () => {
    if (!requireFeature('whatsapp_reminders')) return;
    setShowBulkModal(true);
    setBulkStatus(null);
    try {
      const res = await api.whatsapp.status();
      setBotConnected(res.status === 'CONNECTED' || res.status === 'AUTHENTICATED');
    } catch (e) {
      setBotConnected(false);
    }
  };

  const handleStartBulkReminder = async () => {
    if (pendingCustomers.length === 0) return;
    setBulkSending(true);
    setBulkStatus({ sent: 0, failed: 0, total: pendingCustomers.length });

    try {
      const shopName = shopData?.shopName || shopData?.name || 'आमच्या दुकानातून';
      const res = await api.whatsapp.sendBulkReminder(pendingCustomers, shopName);
      if (res.results) {
        setBulkStatus({
          sent: res.results.sent,
          failed: res.results.failed,
          total: res.results.total,
          completed: true
        });
        await fetchCustomers();
      } else {
        setBulkStatus({
          sent: 0,
          failed: pendingCustomers.length,
          total: pendingCustomers.length,
          completed: true,
          error: res.error || 'मेसेज पाठवता आला नाही.'
        });
      }
    } catch (err: any) {
      console.error('Bulk send error', err);
      setBulkStatus({
        sent: 0,
        failed: pendingCustomers.length,
        total: pendingCustomers.length,
        completed: true,
        error: err.message || 'Error occurred while sending'
      });
    } finally {
      setBulkSending(false);
    }
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

        <div className="flex items-center gap-3 flex-wrap">
          {/* Bulk WhatsApp Reminder Button */}
          <Button
            onClick={handleOpenBulkModal}
            disabled={pendingCustomers.length === 0}
            className="h-14 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2.5 transition-all active:scale-95 disabled:opacity-50 relative"
          >
            <MessageCircle className="h-5 w-5 fill-white/20" />
            <div className="text-left leading-tight">
              <div className="text-[10px] uppercase tracking-wider text-emerald-200 font-extrabold flex items-center gap-1">
                Auto Reminder {!canAccess('whatsapp_reminders') && <span className="bg-amber-400 text-slate-950 px-1 rounded text-[9px] font-black">🔒 PLUS</span>}
              </div>
              <div className="text-sm font-black flex items-center gap-1.5">
                Send Bulk WhatsApp
                <span className="bg-emerald-800 text-white text-[11px] px-2 py-0.5 rounded-full font-black">
                  {pendingCustomers.length}
                </span>
              </div>
            </div>
          </Button>

          <div className="bg-orange-500/10 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 px-5 py-3 rounded-2xl border border-orange-500/20 shadow-sm flex items-center gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Market Udhar</p>
              <p className="text-3xl font-black flex items-center text-orange-600 dark:text-orange-400 mt-0.5">
                <IndianRupee className="h-6 w-6 mr-1" /> {totalUdhar.toFixed(2)}
              </p>
            </div>
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
                  <div className="flex items-start gap-3">
                    {customer.photoUrl ? (
                      <img 
                        src={customer.photoUrl} 
                        alt={customer.name} 
                        className="h-11 w-11 rounded-full object-cover border-2 border-primary/30 shrink-0" 
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                        {customer.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{customer.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {customer.phone || 'No phone'}
                      </p>
                      {customer.aadharPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewAadhaar({ title: `Aadhaar Card: ${customer.name}`, url: customer.aadharPhotoUrl! })}
                          className="mt-1.5 text-[11px] text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> View Aadhaar Card
                        </button>
                      )}
                    </div>
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
                      className="text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center"
                      onClick={() => handleWhatsAppReminder(customer)}
                      title={canAccess('whatsapp_reminders') ? "Send WhatsApp Reminder" : "WhatsApp Reminder (Plus Feature - Click to Upgrade)"}
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> Reminder
                      {!canAccess('whatsapp_reminders') && (
                        <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-600 px-1 py-0.2 rounded font-black">
                          🔒
                        </span>
                      )}
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
              <div className="flex items-center gap-3">
                {ledgerCustomer.photoUrl && (
                  <img src={ledgerCustomer.photoUrl} alt="Customer" className="h-11 w-11 rounded-full object-cover border-2 border-primary/30 shrink-0" />
                )}
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" /> {ledgerCustomer.name} - Statement
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Phone: {ledgerCustomer.phone || 'N/A'}</span>
                    <span>•</span>
                    <span>Udhar Balance: <strong className="text-red-500">₹{Number(ledgerCustomer.balance || 0).toFixed(2)}</strong></span>
                    {ledgerCustomer.aadharPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewAadhaar({ title: `Aadhaar Card: ${ledgerCustomer.name}`, url: ledgerCustomer.aadharPhotoUrl! })}
                        className="text-[11px] text-emerald-700 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded font-semibold flex items-center gap-1 cursor-pointer hover:bg-emerald-200 transition-colors"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> View Aadhaar Card
                      </button>
                    )}
                  </p>
                </div>
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

      {/* Bulk WhatsApp Reminder Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground rounded-3xl border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white relative">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-6 w-6" />
                    <h2 className="text-xl font-black">सर्व ग्राहकांना WhatsApp आठवण मेसेज</h2>
                  </div>
                  <p className="text-xs text-emerald-100 font-medium">
                    ज्यांची उधारी बाकी आहे अशा सर्व ग्राहकांना एका क्लिकवर आपोआप मेसेज पाठवा.
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-white hover:bg-white/20 rounded-full"
                  onClick={() => setShowBulkModal(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Bot Connection Status */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
                botConnected 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${botConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>
                    {botConnected 
                      ? 'WhatsApp Bot चालू आहे 🟢 (थेट मेसेज जाईल)' 
                      : 'WhatsApp Bot ऑफलाइन आहे (Settings मध्ये QR स्कॅन करा)'}
                  </span>
                </div>
                {!botConnected && (
                  <Link to="/settings" className="underline font-bold text-amber-900 dark:text-amber-200">
                    Connect Bot →
                  </Link>
                )}
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 p-3.5 rounded-2xl border text-center">
                  <p className="text-xs text-muted-foreground font-semibold">एकूण थकबाकीदार ग्राहक</p>
                  <p className="text-2xl font-black text-foreground mt-0.5">{pendingCustomers.length}</p>
                </div>
                <div className="bg-muted/40 p-3.5 rounded-2xl border text-center">
                  <p className="text-xs text-muted-foreground font-semibold">एकूण बाकी रक्कम</p>
                  <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-0.5">₹{totalUdhar.toFixed(2)}</p>
                </div>
              </div>

              {/* Message Preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">मेसेज असा दिसेल (Message Preview):</label>
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-3.5 text-xs text-foreground font-mono whitespace-pre-wrap leading-relaxed">
{`🙏 *नमस्ते [ग्राहकाचे नाव] जी,*

*${shopData?.shopName || shopData?.name || 'आमच्या दुकानातून'}* कडून नम्र आठवण:
आपल्याकडे उधारी बाकी: *₹[शिल्लक रक्कम]* शिल्लक आहे.

कृपया सवडीनुसार रक्कम जमा करावी ही विनंती. काही अडचण असल्यास संपर्क साधावा.

धन्यवाद! 💐`}
                </div>
              </div>

              {/* Customer List */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  मेसेज जाणारे ग्राहक ({pendingCustomers.length}):
                </label>
                <div className="max-h-40 overflow-y-auto border rounded-2xl divide-y text-xs">
                  {pendingCustomers.map((c) => (
                    <div key={c.id} className="p-2.5 flex items-center justify-between hover:bg-muted/30">
                      <div>
                        <p className="font-bold text-foreground">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.phone ? `+91 ${c.phone}` : '⚠️ फोन नंबर नाही'}</p>
                      </div>
                      <span className="font-black text-red-600">₹{Number(c.balance || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sending / Status feedback */}
              {bulkStatus && (
                <div className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in duration-200 ${
                  bulkStatus.completed 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-200' 
                    : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 text-blue-800 dark:text-blue-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    {bulkStatus.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                      <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
                    )}
                    <span>
                      {bulkStatus.completed 
                        ? `पूर्ण झाले! एकूण ${bulkStatus.sent} ग्राहकांना WhatsApp मेसेज यशस्वीरित्या पाठवले.`
                        : `मेसेज पाठवत आहे... कृपया थांबा.`}
                    </span>
                  </div>
                  {bulkStatus.failed > 0 && (
                    <p className="text-amber-700 dark:text-amber-300 font-semibold">
                      ⚠️ {bulkStatus.failed} ग्राहकांना फोन नंबर नसल्यामुळे मेसेज पाठवता आला नाही.
                    </p>
                  )}
                  {bulkStatus.error && (
                    <p className="text-red-600 font-bold">{bulkStatus.error}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t bg-muted/20 flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowBulkModal(false)}
                disabled={bulkSending}
              >
                Close
              </Button>
              <Button
                onClick={handleStartBulkReminder}
                disabled={bulkSending || pendingCustomers.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-md"
              >
                {bulkSending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> 🚀 Send All Reminders Now</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Aadhaar Image Lightbox Modal */}
      {previewAadhaar && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground p-0 rounded-2xl border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-muted/40">
              <h3 className="font-bold text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                {previewAadhaar.title}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setPreviewAadhaar(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4 flex justify-center bg-black/5 dark:bg-black/40">
              <img 
                src={previewAadhaar.url} 
                alt="Aadhaar Preview" 
                className="max-h-[70vh] w-auto object-contain rounded-lg border shadow-md"
              />
            </div>
            <div className="p-3 border-t bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
              <span>Verified customer identity record</span>
              <Button size="sm" variant="outline" onClick={() => setPreviewAadhaar(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
