import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, LogOut, Bell, WifiOff, RefreshCw, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, getOfflineQueue, syncOfflineQueue } from '../lib/api';
import { Sidebar, MobileBottomNav, MobileMoreMenu } from './Sidebar';

export default function Layout() {
  const { userData, shopData, logout } = useAuth();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isPosPage = location.pathname === '/pos';

  useEffect(() => {
    // Listen for PWA installation prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    // Check initial offline queue
    setOfflineCount(getOfflineQueue().length);

    const handleOnline = async () => {
      setIsOnline(true);
      const queue = getOfflineQueue();
      if (queue.length > 0) {
        setIsSyncing(true);
        try {
          const res = await syncOfflineQueue();
          setOfflineCount(res.remaining);
        } finally {
          setIsSyncing(false);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOfflineCount(getOfflineQueue().length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodically poll offline queue count
    const interval = setInterval(() => {
      setOfflineCount(getOfflineQueue().length);
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncOfflineQueue();
      setOfflineCount(res.remaining);
      if (res.synced > 0) {
        alert(`${res.synced} offline bill(s) synced to cloud successfully! ✅`);
      }
    } catch (err: any) {
      alert('Sync failed: ' + (err.message || 'Please check connection'));
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.notifications.list();
        if (res && typeof res.unreadCount === 'number') {
          setUnreadNotifs(res.unreadCount);
        }
      } catch {}
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of MartGPT?')) {
      logout();
      navigate('/login');
    }
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } catch (e) {
      console.warn('PWA install prompt error:', e);
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      {/* Top Navigation Bar */}
      <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-md z-40 sticky top-0">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={() => setMoreMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Logo (mobile only) */}
            <div className="flex md:hidden items-center gap-2">
              <div className="h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center shadow-sm">
                <img src="/favicon.svg" alt="Logo" className="h-full w-full object-cover" />
              </div>
              <span className="text-base font-bold text-foreground truncate max-w-[140px]">
                {shopData?.name || 'MartGPT'}
              </span>
            </div>

            {/* Desktop breadcrumb placeholder */}
            <div className="hidden md:block text-sm text-muted-foreground">
              Welcome back, <span className="font-semibold text-foreground">{userData?.displayName || 'User'}</span>
            </div>
          </div>

          {/* Right: Actions, Plan Badge & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-time Cloud Sync & Network Status Widget */}
            {offlineCount > 0 ? (
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                title="Click to sync offline bills to cloud database"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all shadow-xs cursor-pointer animate-pulse"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : `${offlineCount} Offline Bill(s)`}</span>
              </button>
            ) : !isOnline ? (
              <span 
                title="Working in offline mode. Billing and cart are fully operational!"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25"
              >
                <WifiOff className="h-3 w-3" />
                <span>Offline Ready</span>
              </span>
            ) : (
              <span 
                title="Connected to cloud database. Data is backed up in real time."
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 select-none"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Cloud Synced</span>
              </span>
            )}

            {/* PWA Install Button */}
            {deferredPrompt && (
              <button
                onClick={handleInstallPWA}
                title="Install MartGPT App to Home Screen"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm animate-pulse cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            {/* Notification Bell */}
            <button
              onClick={() => navigate('/notifications')}
              title="Notifications & WhatsApp Broadcasts"
              className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifs > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
                  {unreadNotifs > 99 ? '99+' : unreadNotifs}
                </span>
              )}
            </button>

            {/* Desktop User Info & Logout Button */}
            <div className="hidden md:flex items-center gap-3 border-l border-border pl-3 ml-1">
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground leading-tight">{userData?.displayName || 'User'}</p>
                <p className="text-xs text-muted-foreground capitalize">{userData?.role}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {(userData?.displayName || 'U')[0].toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                title="Logout from Account"
                className="flex items-center gap-1.5 px-3 py-1.5 ml-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-200 dark:border-rose-900/50 transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>

            {/* Mobile Header Logout Button */}
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex md:hidden h-9 px-2.5 items-center gap-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-200 dark:border-rose-900/50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block">
          <Sidebar />
        </aside>

        {/* Main Content with Native Touch Scrolling on Mobile */}
        <main className={`flex-1 bg-background ${isPosPage ? 'md:overflow-hidden md:flex md:flex-col overflow-y-auto' : 'overflow-y-auto'} overscroll-y-contain`}>
          <div className={`${isPosPage ? 'p-2 sm:p-3 md:p-4 md:pb-4 max-w-[1600px] md:h-full md:flex md:flex-col min-h-0' : 'p-3 sm:p-4 pb-24 md:p-6 md:pb-6 max-w-7xl'} mx-auto w-full flex-1`}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onOpenMore={() => setMoreMenuOpen(true)} />

      {/* Mobile Drawer */}
      <MobileMoreMenu isOpen={moreMenuOpen} onClose={() => setMoreMenuOpen(false)} unreadNotifs={unreadNotifs} />
    </div>
  );
}
