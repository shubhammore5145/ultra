import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, Loader2, IndianRupee, History, TrendingUp, TrendingDown } from 'lucide-react';
import { collection, query, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Customer } from '../types';

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

  useEffect(() => {
    if (!shopData?.shopId) return;

    const q = query(collection(db, 'shops', shopData.shopId, 'customers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Customer[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Customer);
      });
      // Sort by highest balance first
      data.sort((a, b) => (b.balance || 0) - (a.balance || 0));
      setCustomers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [shopData?.shopId]);

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.shopId || !selectedCustomer || !amount) return;

    setProcessing(true);
    try {
      const batch = writeBatch(db);
      
      const numAmount = Number(amount);
      const newBalance = transactionType === 'credit' 
        ? (selectedCustomer.balance || 0) + numAmount // added udhar
        : (selectedCustomer.balance || 0) - numAmount; // received payment

      // 1. Update customer balance
      const customerRef = doc(db, 'shops', shopData.shopId, 'customers', selectedCustomer.id);
      batch.update(customerRef, { balance: newBalance });

      // 2. Log transaction
      const transactionRef = doc(collection(db, 'shops', shopData.shopId, 'udhar_transactions'));
      batch.set(transactionRef, {
        customerId: selectedCustomer.id,
        amount: numAmount,
        type: transactionType,
        notes: notes || (transactionType === 'credit' ? 'Added Udhar' : 'Received Payment'),
        createdAt: new Date().toISOString()
      });

      await batch.commit();

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

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  const totalUdhar = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <History className="h-8 w-8" /> Udhar Book
        </h1>
        <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 px-4 py-2 rounded-xl border border-orange-200 dark:border-orange-800">
          <p className="text-sm font-medium">Total Market Udhar</p>
          <p className="text-2xl font-bold flex items-center">
            <IndianRupee className="h-5 w-5 mr-1" /> {totalUdhar.toFixed(2)}
          </p>
        </div>
      </div>

      {selectedCustomer && (
        <div className="bg-card text-card-foreground border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Record Transaction for {selectedCustomer.name}</h2>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className={`font-bold ${selectedCustomer.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                ₹{selectedCustomer.balance?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>

          <form onSubmit={handleTransaction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Transaction Type *</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={transactionType === 'payment' ? 'default' : 'outline'}
                    className={`flex-1 ${transactionType === 'payment' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    onClick={() => setTransactionType('payment')}
                  >
                    <TrendingDown className="mr-2 h-4 w-4" /> Received Payment
                  </Button>
                  <Button
                    type="button"
                    variant={transactionType === 'credit' ? 'default' : 'outline'}
                    className={`flex-1 ${transactionType === 'credit' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                    onClick={() => setTransactionType('credit')}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" /> Gave Udhar
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount ₹ *</label>
                <Input 
                  required 
                  type="number"
                  min="1"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount" 
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="E.g., Paid via UPI, or Bought Rice" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setSelectedCustomer(null)}>Cancel</Button>
              <Button type="submit" disabled={processing}>
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Transaction
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-2 bg-card border rounded-lg p-2 shadow-sm">
        <Search className="h-5 w-5 text-muted-foreground ml-2" />
        <Input 
          className="border-0 shadow-none focus-visible:ring-0 text-base bg-transparent" 
          placeholder="Search customers..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-card border rounded-xl">
            <p>No customers found.</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold">{customer.name}</h3>
                  <p className="text-sm text-muted-foreground">{customer.phone || 'No phone'}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${customer.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    ₹{customer.balance?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-muted-foreground">Balance</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setTransactionType('payment');
                  }}
                >
                  Pay
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setTransactionType('credit');
                  }}
                >
                  Give Udhar
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
