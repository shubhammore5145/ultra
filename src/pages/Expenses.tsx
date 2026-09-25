import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Plus, 
  Trash,
  Loader2,
  Wallet,
  Calendar,
  IndianRupee,
  FileText
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Expense } from '../types';

export default function Expenses() {
  const { shopData, user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Other');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const categories: Expense['category'][] = ['Stock', 'Salary', 'Electricity', 'Rent', 'Maintenance', 'Other'];

  useEffect(() => {
    if (!shopData?.shopId) return;

    const fetchExpenses = async () => {
      try {
        const data = await api.expenses.list();
        setExpenses(data);
      } catch (err) {
        console.error('Failed to load expenses', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchExpenses();
  }, [shopData?.shopId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.shopId || !user?.uid) return;
    
    setIsAdding(true);
    try {
      await api.expenses.create({
        id: crypto.randomUUID(),
        category,
        amount: Number(amount),
        description,
        date: date,
        createdAt: new Date().toISOString()
      });
      
      const data = await api.expenses.list();
      setExpenses(data);
      
      // Reset form
      setAmount('');
      setDescription('');
      setCategory('Other');
      setShowForm(false);
    } catch (error) {
      console.error('Failed to add expense', error);
      alert('Failed to add expense');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!shopData?.shopId) return;
    if (confirm('Are you sure you want to delete this expense?')) {
      try {
        await api.expenses.delete(id);
        setExpenses(expenses.filter(e => e.id !== id));
      } catch (error) {
        console.error('Failed to delete expense', error);
        alert('Failed to delete expense');
      }
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="h-8 w-8 text-primary" /> Expenses (खर्च)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your daily shop expenses to calculate real profit.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add Expense</>}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-semibold mb-4">New Expense Entry</h2>
          <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  required
                  type="number" 
                  min="0"
                  step="0.01"
                  className="pl-9" 
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  required
                  type="date"
                  className="pl-9"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="e.g. June Light Bill"
                  className="pl-9"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="col-span-1 md:col-span-2 flex justify-end mt-2">
              <Button type="submit" disabled={isAdding || !amount}>
                {isAdding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : 'Save Expense'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Total Expenses Logged</h3>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            ₹{totalExpenses.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No expenses logged yet.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(expense.date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {expense.description || '-'}
                    </td>
                    <td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">
                      ₹{Number(expense.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(expense.id)}>
                        <Trash className="h-4 w-4" />
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
  );
}
