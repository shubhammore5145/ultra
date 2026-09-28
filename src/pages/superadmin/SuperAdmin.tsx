import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { 
  ShieldCheck, 
  Crown, 
  Store, 
  Users, 
  DollarSign, 
  Sparkles, 
  Search, 
  RefreshCw, 
  Edit3, 
  Trash2, 
  MessageSquare, 
  Phone, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Lock, 
  KeyRound, 
  Package, 
  Receipt, 
  TrendingUp, 
  ChevronRight,
  X,
  ExternalLink,
  ArrowUpRight,
  Filter
} from 'lucide-react';

interface ShopItem {
  shopId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  upiId: string | null;
  plan: string;
  planExpiry: string | null;
  createdAt: string;
  productCount: number;
  userCount: number;
  transactionCount: number;
  totalSalesVolume: number;
  subscriptionStatus: 'active' | 'expiring_soon' | 'expired' | 'lifetime' | 'free';
}

interface StatsData {
  totalShops: number;
  totalUsers: number;
  totalProducts: number;
  totalTransactions: number;
  planCounts: {
    free: number;
    pro: number;
    ultra_pro: number;
  };
  activeSubscriptions: number;
  estimatedMonthlyRevenue: number;
  estimatedAnnualRevenue: number;
  expiringSoon: number;
}

export default function SuperAdmin() {
  const { userData, shopData } = useAuth();
  
  // Super Admin verification
  const isSuperAdminEmail = 
    ['shubham45mgm@gmail.com', 'shubhamnmore16@gmail.com', 'shubhamvmore12@gmail.com', 'shubham@example.com'].includes(userData?.email?.toLowerCase() || '') ||
    (userData?.email && userData.email.toLowerCase().includes('shubham')) ||
    (userData?.displayName && userData.displayName.toLowerCase().includes('shubham')) ||
    shopData?.phone === '9226345875';

  const [pin, setPin] = useState(localStorage.getItem('superadmin_pin') || '');
  const [pinInput, setPinInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(isSuperAdminEmail || localStorage.getItem('superadmin_pin') === '9226');
  const [unlockError, setUnlockError] = useState('');

  const [stats, setStats] = useState<StatsData | null>(null);
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro' | 'ultra_pro'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired' | 'lifetime'>('all');

  // Modals
  const [editModalShop, setEditModalShop] = useState<ShopItem | null>(null);
  const [editPlan, setEditPlan] = useState<'free' | 'pro' | 'ultra_pro'>('pro');
  const [editDuration, setEditDuration] = useState<number>(365);
  const [editSaving, setEditSaving] = useState(false);

  const [detailsModalShop, setDetailsModalShop] = useState<ShopItem | null>(null);
  const [deleteModalShop, setDeleteModalShop] = useState<ShopItem | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'shops'>('overview');

  const loadData = async (masterPin?: string) => {
    try {
      setRefreshing(true);
      const activePin = masterPin || pin || (isSuperAdminEmail ? '9226' : undefined);
      
      const [statsRes, shopsRes] = await Promise.all([
        api.superadmin.getStats(activePin),
        api.superadmin.getShops(activePin)
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (shopsRes.success) setShops(shopsRes.shops);
    } catch (err: any) {
      console.error('Super Admin fetch error:', err);
      if (!isSuperAdminEmail) {
        setIsUnlocked(false);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isUnlocked]);

  const handleUnlockWithPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === '9226' || isSuperAdminEmail) {
      localStorage.setItem('superadmin_pin', '9226');
      setPin('9226');
      setIsUnlocked(true);
      setUnlockError('');
      loadData('9226');
    } else {
      setUnlockError('चुकीचा मास्टर पिन! कृपया अधिकृत पिन टाका.');
    }
  };

  const handleUpdatePlan = async () => {
    if (!editModalShop) return;
    setEditSaving(true);
    try {
      await api.superadmin.updatePlan(editModalShop.shopId, {
        plan: editPlan,
        durationDays: editPlan === 'free' ? 0 : editDuration
      });
      alert(`🎉 ${editModalShop.shopName} चा प्लॅन यशस्वीरित्या ${editPlan.toUpperCase()} करण्यात आला!`);
      setEditModalShop(null);
      loadData();
    } catch (err: any) {
      alert(`अपडेट अयशस्वी: ${err.message}`);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteShop = async () => {
    if (!deleteModalShop) return;
    setDeleteSaving(true);
    try {
      await api.superadmin.deleteShop(deleteModalShop.shopId);
      alert(`दुकान ${deleteModalShop.shopName} कायमचे डिलीट केले.`);
      setDeleteModalShop(null);
      loadData();
    } catch (err: any) {
      alert(`डिलीट करताना त्रुटी: ${err.message}`);
    } finally {
      setDeleteSaving(false);
    }
  };

  // Filtered Shops
  const filteredShops = shops.filter(s => {
    const matchesSearch = 
      (s.shopName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone || '').includes(searchQuery) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.shopId.toLowerCase().includes(searchQuery.toLowerCase());

    const planLower = (s.plan || 'free').toLowerCase();
    const matchesPlan = 
      planFilter === 'all' ||
      (planFilter === 'ultra_pro' && planLower.includes('ultra')) ||
      (planFilter === 'pro' && planLower.includes('pro') && !planLower.includes('ultra')) ||
      (planFilter === 'free' && (!planLower.includes('pro') && !planLower.includes('ultra')));

    const matchesStatus = 
      statusFilter === 'all' ||
      s.subscriptionStatus === statusFilter;

    return matchesSearch && matchesPlan && matchesStatus;
  });

  // If Not Unlocked, show Secret Master Access Gate
  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border p-8 rounded-3xl shadow-2xl text-center space-y-6 animate-scaleIn">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Lock className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-foreground">MartGPT Super Admin</h2>
            <p className="text-xs text-muted-foreground mt-1">
              हा विभाग फक्त मुख्य मालकासाठी (Owner) राखीव आहे. प्रवेश करण्यासाठी मास्टर पिन प्रविष्ट करा.
            </p>
          </div>

          <form onSubmit={handleUnlockWithPin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter 4-Digit Master PIN"
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                maxLength={8}
                className="w-full text-center tracking-widest text-2xl font-bold py-3.5 px-4 rounded-2xl bg-muted border border-border focus:border-primary outline-none transition-all"
                autoFocus
              />
              {unlockError && (
                <p className="text-xs font-bold text-red-500 mt-2">{unlockError}</p>
              )}
            </div>

            <Button type="submit" className="w-full h-12 text-sm font-bold rounded-2xl shadow-lg bg-primary hover:bg-primary/90">
              <KeyRound className="h-4 w-4 mr-2" />
              अनब्लॉक करा (Unlock Portal)
            </Button>
          </form>

          <p className="text-[11px] text-muted-foreground">
            MartGPT Platform Admin Console • Confidential
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 animate-fadeInUp">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 font-bold text-xs uppercase tracking-wider mb-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Super Admin Control Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3 text-foreground">
            MartGPT <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent">Super Admin</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            सर्व दुकाने, पेड सबस्क्रिप्शन्स, कमाई (Revenue), आणि युजर्सचे थेट नियंत्रण.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => loadData()}
            disabled={refreshing}
            className="rounded-2xl text-xs font-bold gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
            रिफ्रेश करा
          </Button>

          <div className="px-3.5 py-1.5 rounded-2xl bg-muted border border-border text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
            <span>लाइव्ह TiDB क्लाउड</span>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Shops */}
        <div className="stat-card relative overflow-hidden bg-gradient-to-br from-card to-indigo-500/5">
          <div className="flex items-center justify-between">
            <span className="stat-label">एकूण दुकाने (Total Shops)</span>
            <Store className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="stat-value text-indigo-600 dark:text-indigo-400 mt-2">
            {stats?.totalShops ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            नोंदणीकृत स्टोअर्स
          </p>
        </div>

        {/* Active Paid Subscriptions */}
        <div className="stat-card relative overflow-hidden bg-gradient-to-br from-card to-yellow-500/5 border-yellow-500/30">
          <div className="flex items-center justify-between">
            <span className="stat-label text-yellow-600">सक्रिय सबस्क्रिप्शन</span>
            <Crown className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="stat-value text-yellow-600 dark:text-yellow-400 mt-2">
            {stats?.activeSubscriptions ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
            <span>⚡ Pro: {stats?.planCounts.pro ?? 0}</span>
            <span>•</span>
            <span>👑 Ultra: {stats?.planCounts.ultra_pro ?? 0}</span>
          </p>
        </div>

        {/* Estimated Monthly Revenue */}
        <div className="stat-card relative overflow-hidden bg-gradient-to-br from-card to-green-500/5 border-green-500/30">
          <div className="flex items-center justify-between">
            <span className="stat-label text-green-600">अंदाजे मासिक कमाई (MRR)</span>
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
          <div className="stat-value text-green-600 dark:text-green-400 mt-2">
            ₹{(stats?.estimatedMonthlyRevenue ?? 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            वार्षिक रन-रेट: ₹{(stats?.estimatedAnnualRevenue ?? 0).toLocaleString('en-IN')}
          </p>
        </div>

        {/* Free Tier vs Expiring */}
        <div className="stat-card relative overflow-hidden bg-gradient-to-br from-card to-purple-500/5">
          <div className="flex items-center justify-between">
            <span className="stat-label">मोफत / बेसिक दुकाने</span>
            <Users className="h-5 w-5 text-purple-500" />
          </div>
          <div className="stat-value text-purple-600 dark:text-purple-400 mt-2">
            {stats?.planCounts.free ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats?.expiringSoon ? `⚠️ ${stats.expiringSoon} दुकानांची मुदत लवकरच संपतेय` : 'सर्व सबस्क्रिप्शन्स सुरळीत'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          प्लॅटफॉर्म विहंगावलोकन (Overview)
        </button>
        <button
          onClick={() => setActiveTab('shops')}
          className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'shops'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Store className="h-4 w-4" />
          सर्व दुकाने व सबस्क्रिप्शन्स ({shops.length})
        </button>
      </div>

      {/* OVERVIEW TAB CONTENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Subscription Breakdown Card */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
            <h3 className="text-lg font-black flex items-center gap-2 text-foreground mb-4">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              सबस्क्रिप्शन प्लॅन विश्लेषण (Subscription Tier Breakdown)
            </h3>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Ultra Pro Box */}
              <div className="p-5 rounded-2xl border-2 border-purple-500/40 bg-purple-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600">
                    👑 ULTRA PRO
                  </span>
                  <span className="text-2xl font-black text-purple-600">
                    {stats?.planCounts.ultra_pro ?? 0}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  वार्षिक ₹४,९९९ / ₹७,९९९ ग्राहक. अमर्याद स्टाफ व मल्टि-काऊंटर.
                </p>
              </div>

              {/* Pro Box */}
              <div className="p-5 rounded-2xl border-2 border-primary/40 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                    ⚡ PRO PLAN
                  </span>
                  <span className="text-2xl font-black text-primary">
                    {stats?.planCounts.pro ?? 0}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  मासिक ₹४९९ ग्राहक. WhatsApp ऑटोमेशन व AI व्हॉईस बिलिंग.
                </p>
              </div>

              {/* Free Box */}
              <div className="p-5 rounded-2xl border border-border bg-muted/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    ⚪ BASIC FREE
                  </span>
                  <span className="text-2xl font-black text-foreground">
                    {stats?.planCounts.free ?? 0}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  बेसिक मोफत युजर्स. यांना Pro मध्ये अपग्रेड करण्यासाठी WhatsApp मेसेज पाठवू शकता.
                </p>
              </div>
            </div>
          </div>

          {/* Platform Total Volume Counters */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-muted-foreground">एकूण प्रॉडक्ट्स (Stock)</div>
                  <div className="text-xl font-black">{stats?.totalProducts ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-muted-foreground">एकूण इनव्हॉइसेस / बिल्स</div>
                  <div className="text-xl font-black">{stats?.totalTransactions ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm col-span-2 md:col-span-1">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-muted-foreground">एकूण युजर्स / कॅशियर्स</div>
                  <div className="text-xl font-black">{stats?.totalUsers ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHOPS & SUBSCRIPTIONS TABLE SECTION */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-foreground flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              स्टोअर्स आणि सबस्क्रिप्शन्स यादी ({filteredShops.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              कोणत्याही दुकानाचा प्लॅन बदला, वाढवा किंवा WhatsApp वर थेट संपर्क साधा.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="दुकान, मालक, मोबाईल किंवा ईमेल शोधा..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl bg-muted border border-border focus:border-primary outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 mr-2">
            <Filter className="h-3 w-3" /> प्लॅन:
          </span>
          {(['all', 'ultra_pro', 'pro', 'free'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                planFilter === p
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'all' ? 'सर्व प्लॅन्स' : p === 'ultra_pro' ? '👑 Ultra Pro' : p === 'pro' ? '⚡ Pro' : '⚪ Free'}
            </button>
          ))}

          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 ml-4 mr-2">
            स्टेटस:
          </span>
          {(['all', 'active', 'expiring_soon', 'expired'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                statusFilter === s
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? 'सर्व स्टेटस' : s === 'active' ? '✅ सक्रिय' : s === 'expiring_soon' ? '⚠️ संपत आलेले' : '❌ संपलेले'}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="p-3.5 font-bold text-foreground">दुकान व मालक (Shop / Owner)</th>
                <th className="p-3.5 font-bold text-foreground">संपर्क (Contact)</th>
                <th className="p-3.5 font-bold text-foreground">सध्याचा प्लॅन (Plan)</th>
                <th className="p-3.5 font-bold text-foreground">वैधता / मुदत (Expiry)</th>
                <th className="p-3.5 font-bold text-foreground text-center">डेटा (Items / Bills)</th>
                <th className="p-3.5 font-bold text-foreground text-right">कृती (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredShops.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    कोणतेही दुकान सापडले नाही.
                  </td>
                </tr>
              ) : (
                filteredShops.map(shop => {
                  const planLower = (shop.plan || 'free').toLowerCase();
                  const isUltra = planLower.includes('ultra');
                  const isPro = planLower.includes('pro') && !isUltra;

                  return (
                    <tr key={shop.shopId} className="hover:bg-muted/30 transition-colors">
                      {/* Shop Name & Owner */}
                      <td className="p-3.5">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          {shop.shopName || 'अनामित स्टोअर'}
                          {isUltra && <Crown className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
                          {isPro && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <span>{shop.ownerName || 'दुकानदार'}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-muted-foreground/80">ID: {shop.shopId}</span>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          {shop.phone ? (
                            <a 
                              href={`https://wa.me/91${shop.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`नमस्कार ${shop.ownerName || ''} जी, मी MartGPT टीमकडून बोलत आहे.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 font-bold text-xs"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              +91 {shop.phone}
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">फोन नाही</span>
                          )}
                          {shop.email && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                              {shop.email}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Current Plan Badge */}
                      <td className="p-3.5">
                        {isUltra ? (
                          <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[11px] font-black uppercase inline-flex items-center gap-1">
                            <Crown className="h-3 w-3" /> Ultra Pro
                          </span>
                        ) : isPro ? (
                          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-black uppercase inline-flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Pro
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-bold uppercase">
                            Free
                          </span>
                        )}
                      </td>

                      {/* Expiry Date */}
                      <td className="p-3.5">
                        {shop.subscriptionStatus === 'lifetime' ? (
                          <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> लाइफटाइम
                          </span>
                        ) : shop.planExpiry ? (
                          <div>
                            <div className="text-xs font-semibold">
                              {new Date(shop.planExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            <div className="text-[10px] mt-0.5">
                              {shop.subscriptionStatus === 'active' && (
                                <span className="text-green-600 font-bold">सक्रिय (Active)</span>
                              )}
                              {shop.subscriptionStatus === 'expiring_soon' && (
                                <span className="text-amber-500 font-bold">⚠️ ७ दिवसांत संपणार</span>
                              )}
                              {shop.subscriptionStatus === 'expired' && (
                                <span className="text-red-500 font-bold">मुदत संपली</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>

                      {/* Data counts */}
                      <td className="p-3.5 text-center">
                        <div className="font-bold text-xs">{shop.productCount} वस्तू</div>
                        <div className="text-[11px] text-muted-foreground">{shop.transactionCount} बिल्स</div>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditModalShop(shop);
                              const p = (shop.plan || 'free').toLowerCase();
                              setEditPlan(p.includes('ultra') ? 'ultra_pro' : p.includes('pro') ? 'pro' : 'pro');
                            }}
                            className="h-8 px-2.5 text-xs font-bold gap-1 text-primary hover:bg-primary/10"
                            title="प्लॅन बदला"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            प्लॅन
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDetailsModalShop(shop)}
                            className="h-8 w-8 p-0"
                            title="तपशील पहा"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteModalShop(shop)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            title="दुकान डिलीट करा"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Edit Plan & Duration */}
      {editModalShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-card border border-border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-black text-lg text-foreground">
                  प्लॅन मॅन्युअल अपडेट करा
                </h3>
                <p className="text-xs text-muted-foreground">
                  दुकान: <span className="font-bold text-foreground">{editModalShop.shopName}</span>
                </p>
              </div>
              <button 
                onClick={() => setEditModalShop(null)}
                className="p-1 rounded-xl text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Plan Choice */}
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-2">
                  नवीन प्लॅन निवडा:
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditPlan('free')}
                    className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                      editPlan === 'free'
                        ? 'border-foreground bg-muted font-black'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    ⚪ Basic Free
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditPlan('pro')}
                    className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                      editPlan === 'pro'
                        ? 'border-primary bg-primary/10 text-primary font-black'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    ⚡ MartGPT Pro
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditPlan('ultra_pro')}
                    className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                      editPlan === 'ultra_pro'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 font-black'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    👑 Ultra Pro
                  </button>
                </div>
              </div>

              {/* Duration Choice (if not free) */}
              {editPlan !== 'free' && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-2">
                    कालावधी (Duration):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { days: 30, label: '१ महिना' },
                      { days: 90, label: '३ महिने' },
                      { days: 180, label: '६ महिने' },
                      { days: 365, label: '१ वर्ष' }
                    ].map(d => (
                      <button
                        key={d.days}
                        type="button"
                        onClick={() => setEditDuration(d.days)}
                        className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                          editDuration === d.days
                            ? 'border-primary bg-primary text-white'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setEditModalShop(null)}
                className="rounded-2xl text-xs font-bold"
              >
                रद्द करा
              </Button>
              <Button
                onClick={handleUpdatePlan}
                disabled={editSaving}
                className="rounded-2xl text-xs font-bold shadow-md bg-primary hover:bg-primary/90 text-white"
              >
                {editSaving ? 'अपडेट होत आहे...' : 'बदल जतन करा (Save Changes)'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Shop Details */}
      {detailsModalShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-card border border-border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-black text-lg text-foreground">
                  {detailsModalShop.shopName}
                </h3>
                <p className="text-xs text-muted-foreground">Shop ID: {detailsModalShop.shopId}</p>
              </div>
              <button 
                onClick={() => setDetailsModalShop(null)}
                className="p-1 rounded-xl text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/40 rounded-2xl">
                <div>
                  <span className="text-muted-foreground">मालकाचे नाव:</span>
                  <p className="font-bold text-foreground mt-0.5">{detailsModalShop.ownerName || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">मोबाईल नंबर:</span>
                  <p className="font-bold text-foreground mt-0.5">{detailsModalShop.phone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">ईमेल:</span>
                  <p className="font-bold text-foreground mt-0.5 truncate">{detailsModalShop.email || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">नोंदणी तारीख:</span>
                  <p className="font-bold text-foreground mt-0.5">
                    {new Date(detailsModalShop.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/40 rounded-2xl">
                <div>
                  <span className="text-muted-foreground">GST नंबर:</span>
                  <p className="font-bold text-foreground mt-0.5">{detailsModalShop.gstNumber || 'नोंदणीकृत नाही'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">UPI ID:</span>
                  <p className="font-bold text-foreground mt-0.5">{detailsModalShop.upiId || 'सेट नाही'}</p>
                </div>
              </div>

              {detailsModalShop.phone && (
                <div className="pt-2">
                  <Button
                    onClick={() => {
                      const text = encodeURIComponent(`नमस्कार ${detailsModalShop.ownerName || ''} जी, मी MartGPT ॲडमिन बोलत आहे.`);
                      window.open(`https://wa.me/91${detailsModalShop.phone.replace(/\D/g, '')}?text=${text}`, '_blank');
                    }}
                    className="w-full text-xs font-bold rounded-2xl bg-green-600 hover:bg-green-700 text-white gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp वर मेसेज करा
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setDetailsModalShop(null)}
                className="rounded-2xl text-xs font-bold"
              >
                बंद करा
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Shop Confirmation */}
      {deleteModalShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-card border border-border w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleIn">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-lg text-foreground">
                दुकान डिलीट करायचे आहे का?
              </h3>
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-red-500">{deleteModalShop.shopName}</span> चा संपूर्ण डेटा (उत्पादने, खाती, बिल्स) कायमचा हटवला जाईल.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <Button
                variant="outline"
                onClick={() => setDeleteModalShop(null)}
                className="rounded-2xl text-xs font-bold"
              >
                रद्द करा
              </Button>
              <Button
                onClick={handleDeleteShop}
                disabled={deleteSaving}
                className="rounded-2xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteSaving ? 'हटवत आहे...' : 'होय, कायमचे डिलीट करा'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
