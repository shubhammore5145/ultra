import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Store, 
  Users, 
  Package, 
  TrendingUp, 
  Search, 
  Crown, 
  Zap, 
  Star, 
  Calendar, 
  Clock, 
  ExternalLink, 
  Trash2, 
  RefreshCw, 
  Lock, 
  Key, 
  Check, 
  Copy, 
  AlertTriangle, 
  Phone, 
  Mail, 
  MapPin, 
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

interface ShopRecord {
  shopId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address?: string;
  gstNumber?: string;
  upiId?: string;
  plan: string;
  planExpiry: string | null;
  createdAt: string;
  productCount: number;
  userCount: number;
  transactionCount: number;
  totalSalesVolume: number;
  status?: string;
  daysRemaining?: number | null;
  formattedExpiry?: string;
}

interface SuperAdminStats {
  totalShops: number;
  totalUsers: number;
  totalProducts: number;
  totalTransactions: number;
  totalSalesVolume: number;
  activePaidSubscriptions: number;
  planCounts: {
    free: number;
    plus: number;
    pro: number;
    ultra_pro: number;
  };
}

const MASTER_PIN = '9226';

export default function SuperAdmin() {
  const { userData, login } = useAuth();
  const navigate = useNavigate();

  // Authentication State
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const savedKey = sessionStorage.getItem('martgpt_superadmin_key');
    if (savedKey === MASTER_PIN) return true;
    const email = userData?.email?.toLowerCase() || '';
    return email.includes('shubham');
  });

  // Data State
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shops, setShops] = useState<ShopRecord[]>([]);
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<'all' | 'ultra_pro' | 'pro' | 'plus' | 'free' | 'expiring'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'sales' | 'products' | 'name'>('newest');

  // Plan Upgrade Modal
  const [selectedShopForPlan, setSelectedShopForPlan] = useState<ShopRecord | null>(null);
  const [newPlan, setNewPlan] = useState<string>('ultra_pro');
  const [planDuration, setPlanDuration] = useState<string>('365'); // days, 'lifetime', or 'custom'
  const [customExpiryDate, setCustomExpiryDate] = useState<string>('');
  const [updatingPlan, setUpdatingPlan] = useState(false);

  // Impersonation State
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // Check pin submit
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === MASTER_PIN) {
      sessionStorage.setItem('martgpt_superadmin_key', MASTER_PIN);
      setIsAuthenticated(true);
      setPinError('');
    } else {
      setPinError('Invalid Master PIN. Please enter the correct authorization key.');
    }
  };

  // Fetch Shops and Stats
  const fetchData = async () => {
    const activeKey = sessionStorage.getItem('martgpt_superadmin_key') || MASTER_PIN;
    setRefreshing(true);
    setErrorMsg('');
    try {
      const [statsRes, shopsRes] = await Promise.all([
        api.superadmin.getStats(activeKey).catch(e => {
          console.warn('Superadmin stats fetch warn:', e);
          return null;
        }),
        api.superadmin.getShops(activeKey).catch(e => {
          console.warn('Superadmin shops fetch warn:', e);
          return { shops: [] };
        })
      ]);

      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }
      if (shopsRes?.shops && Array.isArray(shopsRes.shops)) {
        setShops(shopsRes.shops);
      } else if (Array.isArray(shopsRes)) {
        setShops(shopsRes);
      }
    } catch (err: any) {
      console.error('Superadmin data load error:', err);
      setErrorMsg(err.message || 'Failed to load shops. Please check network connection.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      fetchData();
    }
  }, [isAuthenticated]);

  // Copy Shop ID helper
  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1-Click Login / Impersonate as Shopkeeper
  const handleImpersonate = async (shop: ShopRecord) => {
    if (!confirm(`🚀 Do you want to log into "${shop.shopName || shop.shopId}" as Store Admin?\n\nYou will be able to view and manage their POS billing, products, and ledger directly.`)) {
      return;
    }

    setImpersonatingId(shop.shopId);
    try {
      const masterKey = sessionStorage.getItem('martgpt_superadmin_key') || MASTER_PIN;
      const res = await api.superadmin.impersonate(shop.shopId, masterKey);
      if (res?.success && res.token && res.user) {
        // Save store session
        login(res.token, res.user, res.shop);
        alert(`Logged into ${shop.shopName || shop.shopId} successfully! Redirecting to POS... 🚀`);
        navigate('/pos');
      } else {
        alert('Impersonation failed: ' + (res?.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error entering store: ' + (err.message || 'Network error'));
    } finally {
      setImpersonatingId(null);
    }
  };

  // Save Plan Upgrade
  const handleSavePlan = async () => {
    if (!selectedShopForPlan) return;
    setUpdatingPlan(true);
    try {
      const masterKey = sessionStorage.getItem('martgpt_superadmin_key') || MASTER_PIN;
      let durationDays: number | null = null;
      let customExpiry: string | null = null;

      if (planDuration === 'lifetime') {
        durationDays = 3650; // 10 years
      } else if (planDuration === 'custom') {
        customExpiry = customExpiryDate ? new Date(customExpiryDate).toISOString() : null;
      } else {
        durationDays = parseInt(planDuration, 10) || 30;
      }

      const res = await api.superadmin.updatePlan(
        selectedShopForPlan.shopId,
        {
          plan: newPlan,
          durationDays,
          customExpiry
        },
        masterKey
      );

      if (res?.success) {
        alert(`✅ Plan for "${selectedShopForPlan.shopName || selectedShopForPlan.shopId}" updated to ${newPlan.toUpperCase()} successfully!`);
        setSelectedShopForPlan(null);
        fetchData();
      } else {
        alert('Plan update failed: ' + (res?.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error updating plan: ' + (err.message || 'Server error'));
    } finally {
      setUpdatingPlan(false);
    }
  };

  // Delete Shop
  const handleDeleteShop = async (shop: ShopRecord) => {
    const confirmation = prompt(`⚠️ CAUTION: Deleting this store will delete all associated products, bills, and customers!\n\nTo confirm, type the store name: "${shop.shopName || shop.shopId}"`);
    if (confirmation !== (shop.shopName || shop.shopId)) {
      if (confirmation !== null) alert('Store name did not match. Deletion cancelled.');
      return;
    }

    try {
      const masterKey = sessionStorage.getItem('martgpt_superadmin_key') || MASTER_PIN;
      const res = await api.superadmin.deleteShop(shop.shopId, masterKey);
      if (res?.success) {
        alert(`Shop ${shop.shopName} (${shop.shopId}) has been deleted.`);
        fetchData();
      } else {
        alert('Delete failed: ' + (res?.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error deleting shop: ' + (err.message || 'Server error'));
    }
  };

  // Filtered & Sorted Shops
  const filteredShops = useMemo(() => {
    let result = [...shops];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s => 
        (s.shopName && s.shopName.toLowerCase().includes(q)) ||
        (s.ownerName && s.ownerName.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.shopId && s.shopId.toLowerCase().includes(q))
      );
    }

    // Plan Filter
    if (selectedPlanFilter !== 'all') {
      if (selectedPlanFilter === 'expiring') {
        result = result.filter(s => s.daysRemaining !== null && s.daysRemaining !== undefined && s.daysRemaining <= 7 && s.daysRemaining >= 0);
      } else {
        result = result.filter(s => (s.plan || 'free').toLowerCase() === selectedPlanFilter);
      }
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'sales') {
        return (b.totalSalesVolume || 0) - (a.totalSalesVolume || 0);
      }
      if (sortBy === 'products') {
        return (b.productCount || 0) - (a.productCount || 0);
      }
      if (sortBy === 'name') {
        return (a.shopName || '').localeCompare(b.shopName || '');
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      // default: newest
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return result;
  }, [shops, searchQuery, selectedPlanFilter, sortBy]);

  // Plan Badge Helper
  const renderPlanBadge = (plan: string, expiry?: string | null, daysRemaining?: number | null) => {
    const p = (plan || 'free').toLowerCase();
    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
    let icon = <Store className="h-3.5 w-3.5 mr-1" />;
    let label = 'Free Tier';

    if (p === 'ultra_pro') {
      badgeClass = 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40 font-bold';
      icon = <Crown className="h-3.5 w-3.5 mr-1 text-purple-500" />;
      label = 'Ultra Pro 👑';
    } else if (p === 'pro') {
      badgeClass = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 font-bold';
      icon = <Zap className="h-3.5 w-3.5 mr-1 text-blue-500" />;
      label = 'Pro ⚡';
    } else if (p === 'plus') {
      badgeClass = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold';
      icon = <Star className="h-3.5 w-3.5 mr-1 text-emerald-500" />;
      label = 'Plus 🌟';
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${badgeClass}`}>
          {icon}
          {label}
        </span>
        {daysRemaining !== null && daysRemaining !== undefined && daysRemaining >= 0 && daysRemaining <= 3650 ? (
          <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${
            daysRemaining <= 7 
              ? 'bg-rose-500/10 text-rose-600 border-rose-300 animate-pulse' 
              : 'bg-muted text-muted-foreground border-border'
          }`}>
            ⏳ {daysRemaining} days left
          </span>
        ) : daysRemaining !== null && daysRemaining !== undefined && daysRemaining < 0 ? (
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 border border-rose-300 font-bold">
            ⚠️ Expired
          </span>
        ) : p !== 'free' ? (
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-200 font-semibold">
            ♾️ Lifetime
          </span>
        ) : null}
      </div>
    );
  };

  // Lock Screen if not authorized
  if (!isAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl p-6 sm:p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Super Admin Portal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Restricted Area. Please enter the Super Admin Master PIN to inspect and manage all stores across the network.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter Master PIN (e.g. 9226)"
                className="pl-11 h-12 text-center text-lg tracking-widest font-mono font-bold"
                autoFocus
              />
            </div>

            {pinError && (
              <p className="text-xs text-rose-500 font-semibold bg-rose-500/10 py-2 px-3 rounded-lg border border-rose-500/20">
                {pinError}
              </p>
            )}

            <Button type="submit" className="w-full h-12 font-bold text-base bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25">
              Unlock Super Admin <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Default Key: <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold">9226</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-primary/10 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 font-black text-xl">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Super Admin Central</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                  Network Commander
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Full network visibility: Manage subscriptions, inspect store metrics, and 1-click access any store.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={refreshing}
              className="flex-1 sm:flex-none border-border"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem('martgpt_superadmin_key');
                setIsAuthenticated(false);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Lock className="h-4 w-4 mr-1" /> Lock
            </Button>
          </div>
        </div>
      </div>

      {/* High-level Network Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Registered Shops</p>
            <h3 className="text-2xl font-black text-foreground mt-1">
              {stats?.totalShops ?? shops.length}
            </h3>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              ● All Cloud Synchronized
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Store className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active Paid Subscriptions</p>
            <h3 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {stats?.activePaidSubscriptions ?? shops.filter(s => ['pro', 'ultra_pro', 'plus'].includes((s.plan || '').toLowerCase())).length}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Ultra Pro, Pro & Plus
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <Crown className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Products Listed</p>
            <h3 className="text-2xl font-black text-foreground mt-1">
              {stats?.totalProducts ?? shops.reduce((acc, s) => acc + (s.productCount || 0), 0)}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Across all kirana stores
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Package className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Network Sales Volume</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{(stats?.totalSalesVolume ?? shops.reduce((acc, s) => acc + (s.totalSalesVolume || 0), 0)).toLocaleString('en-IN')}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {stats?.totalTransactions ?? shops.reduce((acc, s) => acc + (s.transactionCount || 0), 0)} Bills Generated
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Plan Distribution Mini Bar */}
      {stats?.planCounts && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <span className="font-semibold text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Sparkles className="h-4 w-4 text-amber-500" /> Plan Distribution:
          </span>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-300 font-bold">
              👑 Ultra Pro: {stats.planCounts.ultra_pro}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-300 font-bold">
              ⚡ Pro: {stats.planCounts.pro}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-300 font-bold">
              🌟 Plus: {stats.planCounts.plus}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-300 font-medium">
              ⚪ Free: {stats.planCounts.free}
            </span>
          </div>
        </div>
      )}

      {/* Controls: Search, Plan Filters, Sorting */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search store name, owner name, mobile, email, or shop ID..."
              className="pl-9 h-10"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="newest">📅 Newest Created First</option>
              <option value="oldest">📅 Oldest First</option>
              <option value="sales">💰 Highest Sales Volume</option>
              <option value="products">📦 Most Products</option>
              <option value="name">🔤 Store Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Plan Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: `All Stores (${shops.length})` },
            { id: 'ultra_pro', label: '👑 Ultra Pro' },
            { id: 'pro', label: '⚡ Pro' },
            { id: 'plus', label: '🌟 Plus' },
            { id: 'free', label: '⚪ Free' },
            { id: 'expiring', label: '⏳ Expiring Soon (≤7d)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedPlanFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedPlanFilter === tab.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stores List / Cards */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-3 font-medium">Loading store network database...</p>
        </div>
      ) : filteredShops.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-3">
          <Store className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <h3 className="text-lg font-bold text-foreground">No shops found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery ? `No store matches "${searchQuery}". Try searching with another term.` : 'No shops registered under this plan filter.'}
          </p>
          {searchQuery && (
            <Button size="sm" variant="outline" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 font-medium">
            <span>Showing {filteredShops.length} of {shops.length} total registered stores</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredShops.map((shop) => (
              <div
                key={shop.shopId}
                className="bg-card border border-border hover:border-primary/40 rounded-2xl p-4 sm:p-5 shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Store Info */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                      {shop.shopName || 'Unnamed Kirana Store'}
                    </h3>
                    {renderPlanBadge(shop.plan, shop.planExpiry, shop.daysRemaining)}
                  </div>

                  {/* ID & Owner Details */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <button
                      onClick={() => handleCopy(shop.shopId)}
                      title="Click to copy Shop ID"
                      className="inline-flex items-center gap-1 font-mono font-bold text-primary hover:underline cursor-pointer bg-primary/10 px-2 py-0.5 rounded"
                    >
                      <span>ID: {shop.shopId}</span>
                      {copiedId === shop.shopId ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>

                    {shop.ownerName && (
                      <span className="flex items-center gap-1 text-foreground font-medium">
                        👤 {shop.ownerName}
                      </span>
                    )}

                    {shop.phone && (
                      <a
                        href={`tel:${shop.phone}`}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                        <span>{shop.phone}</span>
                      </a>
                    )}

                    {shop.email && (
                      <a
                        href={`mailto:${shop.email}`}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[180px]">{shop.email}</span>
                      </a>
                    )}

                    {shop.address && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]" title={shop.address}>
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{shop.address}</span>
                      </span>
                    )}

                    {shop.createdAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Joined: {new Date(shop.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </span>
                    )}
                  </div>

                  {/* Key Metrics Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-semibold flex items-center gap-1">
                      <Package className="h-3 w-3 text-blue-500" />
                      <span>{shop.productCount || 0} Products</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-semibold flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                      <span>{shop.transactionCount || 0} Bills (₹{(shop.totalSalesVolume || 0).toLocaleString('en-IN')})</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-semibold flex items-center gap-1">
                      <Users className="h-3 w-3 text-cyan-500" />
                      <span>{shop.userCount || 1} Staff</span>
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                  {/* 1-Click Login to Store */}
                  <Button
                    size="sm"
                    onClick={() => handleImpersonate(shop)}
                    disabled={impersonatingId === shop.shopId}
                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-xs cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    {impersonatingId === shop.shopId ? 'Entering...' : 'Login to Store'}
                  </Button>

                  {/* Change / Upgrade Plan */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedShopForPlan(shop);
                      setNewPlan(shop.plan || 'ultra_pro');
                      setPlanDuration('365');
                    }}
                    className="flex-1 md:flex-none border-primary/30 text-primary hover:bg-primary/10 font-bold text-xs h-9 cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5 mr-1 text-amber-500" />
                    Change Plan
                  </Button>

                  {/* Delete Shop */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteShop(shop)}
                    title="Delete Shop"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan Upgrade / Duration Modal */}
      {selectedShopForPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" /> Upgrade / Change Store Plan
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Store: <span className="font-bold text-foreground">{selectedShopForPlan.shopName || selectedShopForPlan.shopId}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedShopForPlan(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Select Plan */}
              <div>
                <label className="font-bold text-foreground block mb-2">Select Subscription Plan:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'ultra_pro', title: 'Ultra Pro 👑', desc: 'All AI features, WhatsApp, multi-counter, priority', border: 'border-purple-500' },
                    { id: 'pro', title: 'Pro ⚡', desc: 'Unlimited products, thermal billing, analytics', border: 'border-blue-500' },
                    { id: 'plus', title: 'Plus 🌟', desc: 'Basic cloud sync, up to 500 products', border: 'border-emerald-500' },
                    { id: 'free', title: 'Free ⚪', desc: 'Single register, basic inventory', border: 'border-slate-400' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNewPlan(p.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newPlan === p.id 
                          ? `${p.border} bg-primary/10 shadow-xs ring-1 ring-primary` 
                          : 'border-border bg-muted/40 hover:bg-muted'
                      }`}
                    >
                      <div className="font-bold text-foreground text-sm">{p.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Duration */}
              {newPlan !== 'free' && (
                <div>
                  <label className="font-bold text-foreground block mb-2">Select Plan Duration / Validity:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '30', label: '+30 Days (1 Mo)' },
                      { id: '90', label: '+90 Days (3 Mo)' },
                      { id: '180', label: '+180 Days (6 Mo)' },
                      { id: '365', label: '+365 Days (1 Yr)' },
                      { id: 'lifetime', label: '♾️ Lifetime' },
                      { id: 'custom', label: '📅 Custom Date' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setPlanDuration(d.id)}
                        className={`py-2 px-2 rounded-lg border text-center font-semibold cursor-pointer ${
                          planDuration === d.id
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  {planDuration === 'custom' && (
                    <div className="mt-3">
                      <label className="font-medium text-muted-foreground block mb-1">Set Expiry Date:</label>
                      <Input
                        type="date"
                        value={customExpiryDate}
                        onChange={(e) => setCustomExpiryDate(e.target.value)}
                        className="h-10 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-700 dark:text-amber-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" /> Immediate Activation:
                </p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  Changing the plan instantly unlocks premium features for this shop and sends an in-app notification to the shopkeeper.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedShopForPlan(null)}
                disabled={updatingPlan}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSavePlan}
                disabled={updatingPlan}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                {updatingPlan ? 'Saving Plan...' : 'Activate Plan Now 🚀'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
