import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Trash2, Loader2, Wallet, Calendar, IndianRupee, FileText, TrendingDown } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Expense } from '../types';

const categories: Expense['category'][] = ['Stock', 'Salary', 'Electricity', 'Rent', 'Maintenance', 'Other'];

const categoryColors: Record<string, string> = {
  Stock: 'badge-primary',
  Salary: 'badge-success',
  Electricity: 'badge-warning',
  Rent: 'badge-danger',
  Maintenance: 'badge-warning',
  Other: '',
};

export default function Expenses() {
  const { shopData, user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Other');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLoading(true);
    api.expenses.list()
      .then(data => setExpenses(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error('Failed to load expenses', err);
        setExpenses([]);
      })
      .finally(() => setLoading(false));
  }, [shopData?.shopId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.shopId || !user?.uid) return;
    setIsAdding(true);
    try {
      await api.expenses.create({ id: crypto.randomUUID(), category, amount: Number(amount), description, date, createdAt: new Date().toISOString() });
      const data = await api.expenses.list();
      setExpenses(data);
      setAmount(''); setDescription(''); setCategory('Other'); setShowForm(false);
    } catch (error) {
      console.error(error); alert('Failed to add expense');
    } finally { setIsAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.expenses.delete(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch { alert('Failed to delete'); }
  };

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const todayExpenses = expenses.filter(e => new Date(e.date).toDateString() === new Date().toDateString()).reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wallet className="h-7 w-7 text-amber-500" /> Expenses
          </h1>
          <p className="page-subtitle">Track daily shop expenses to calculate real profit</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'default'} className="h-9 gap-2">
          {showForm ? 'Cancel' : <><Plus className="h-4 w-4" /> Add Expense</>}
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 stagger">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">Today's Expenses</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <div className="stat-value text-amber-600">₹{todayExpenses.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">All-Time Expenses</span>
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <div className="stat-value text-red-600">₹{totalExpenses.toFixed(2)}</div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="kirana-card animate-scaleIn">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> New Expense Entry
            </h2>
          </div>
          <form onSubmit={handleAddExpense} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Amount (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input required type="number" min="0" step="0.01" className="pl-9" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Category</label>
              <select className="kirana-select" value={category} onChange={e => setCategory(e.target.value as any)}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input required type="date" className="pl-9" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Description (Optional)</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="e.g. June Light Bill" className="pl-9" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </div>
            <div className="col-span-full flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={isAdding || !amount}>
                {isAdding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save Expense
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="kirana-card">
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Expense History</h2>
          <span className="text-sm text-muted-foreground">{expenses.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="kirana-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}>
                  <div className="empty-state py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Loading expenses...</p>
                  </div>
                </td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Wallet className="h-7 w-7" /></div>
                    <p className="empty-state-title">No expenses recorded</p>
                    <p className="empty-state-desc">Add your first expense to track your costs</p>
                  </div>
                </td></tr>
              ) : expenses.map(expense => (
                <tr key={expense.id}>
                  <td className="text-muted-foreground">{new Date(expense.date).toLocaleDateString('en-IN')}</td>
                  <td><span className={"badge " + (categoryColors[expense.category] || "badge-primary")}>{expense.category}</span></td>
                  <td className="text-foreground">{expense.description || <span className="text-muted-foreground">—</span>}</td>
                  <td className="font-semibold text-red-600">₹{Number(expense.amount || 0).toFixed(2)}</td>
                  <td className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDelete(expense.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

