import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Package, Users, CreditCard,
  FileText, Settings, ArrowLeftRight, Wallet, Crown,
  HelpCircle, ClipboardList, LogOut, X, Barcode, Bell,
  Receipt, TrendingUp, UserCheck, Trash2, Menu
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import { api } from '../lib/api';
import { hasPermission } from '../lib/permissions';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, permissionKey: 'dashboard', roles: ['admin'], color: 'text-indigo-500' },
  { name: 'POS Billing', href: '/pos', icon: ShoppingCart, permissionKey: 'pos', roles: ['admin', 'cashier'], color: 'text-emerald-500' },
  { name: 'Bill Store', href: '/bill-store', icon: Receipt, permissionKey: 'bill_store', roles: ['admin', 'cashier'], color: 'text-teal-500' },
  { name: 'Products', href: '/products', icon: Package, permissionKey: 'products', roles: ['admin', 'cashier'], color: 'text-blue-500' },
  { name: 'Barcode Print', href: '/barcode-print', icon: Barcode, permissionKey: 'barcode_print', roles: ['admin', 'cashier'], color: 'text-violet-500' },
  { name: 'Inventory & AI', href: '/inventory', icon: ClipboardList, permissionKey: 'inventory_ai', roles: ['admin', 'cashier'], color: 'text-purple-500' },
  { name: 'Customers', href: '/customers', icon: Users, permissionKey: 'customers', roles: ['admin', 'cashier'], color: 'text-cyan-500' },
  { name: 'Udhar Book', href: '/udhar', icon: CreditCard, permissionKey: 'udhar', roles: ['admin', 'cashier'], color: 'text-rose-500' },
  { name: 'Staff & Salary', href: '/staff', icon: UserCheck, permissionKey: 'staff', roles: ['admin'], color: 'text-blue-500' },
  { name: 'Digital Analytics', href: '/analytics', icon: TrendingUp, permissionKey: 'analytics', roles: ['admin'], color: 'text-emerald-600' },
  { name: 'Purchases', href: '/purchases', icon: ArrowLeftRight, permissionKey: 'purchases', roles: ['admin'], color: 'text-orange-500' },
  { name: 'Expenses', href: '/expenses', icon: Wallet, permissionKey: 'expenses', roles: ['admin'], color: 'text-amber-500' },
  { name: 'Reports', href: '/reports', icon: FileText, permissionKey: 'reports', roles: ['admin'], color: 'text-indigo-400' },
  { name: 'Recycle Bin', href: '/recycle-bin', icon: Trash2, permissionKey: 'recycle_bin', roles: ['admin'], color: 'text-rose-500' },
  { name: 'Notifications', href: '/notifications', icon: Bell, permissionKey: 'notifications', roles: ['admin', 'cashier'], color: 'text-amber-500' },
  { name: 'Settings', href: '/settings', icon: Settings, permissionKey: 'settings', roles: ['admin'], color: 'text-slate-500' },
  { name: 'Upgrade', href: '/upgrade', icon: Crown, permissionKey: 'upgrade', roles: ['admin'], color: 'text-yellow-500' },
  { name: 'Support', href: '/support', icon: HelpCircle, permissionKey: 'support', roles: ['admin', 'cashier'], color: 'text-green-500' },
];

/** Desktop Sidebar */
export function Sidebar() {
  const { userData, shopData, logout } = useAuth();
  const { plan, canAccess, openUpgradeModal } = usePlan();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const filteredNav = navItems.filter(item => {
    if (userData?.role === 'admin') return true;
    if (item.permissionKey === 'notifications' || item.permissionKey === 'support') return true;
    return hasPermission(userData, item.permissionKey);
  });

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

  return (
    <div className="flex h-full w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shadow-md shadow-primary/30">
          <img src="/favicon.svg" alt="MartGPT" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground leading-tight">{shopData?.name || 'MartGPT'}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-muted-foreground capitalize">{userData?.role || 'Admin'}</span>
            <span className="text-[10px] text-muted-foreground">•</span>
            {plan === 'ultra_pro' ? (
              <span className="text-[10px] font-black text-purple-400">👑 Ultra</span>
            ) : plan === 'pro' ? (
              <span className="text-[10px] font-black text-indigo-400">⚡ Pro</span>
            ) : plan === 'plus' ? (
              <span className="text-[10px] font-bold text-blue-400">🌟 Plus</span>
            ) : (
              <button 
                onClick={() => openUpgradeModal()}
                className="text-[10px] font-bold text-amber-500 hover:underline"
              >
                Free ⚡
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                'nav-item ' + (isActive ? 'nav-item-active' : 'nav-item-inactive')
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Icon className={'h-4 w-4 flex-shrink-0 ' + (isActive ? 'text-white' : item.color)} />
                  <span className="truncate">{item.name}</span>
                  {item.href === '/notifications' && unreadNotifs > 0 && (
                    <span className="ml-auto text-[10px] font-black px-1.5 py-0.2 rounded-full bg-rose-500 text-white animate-pulse">
                      {unreadNotifs}
                    </span>
                  )}
                  {item.href === '/barcode-print' && !canAccess('barcode_print') && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/20">
                      🔒 Plus
                    </span>
                  )}
                  {item.href === '/upgrade' && (
                    <span className="ml-auto text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
                      ⚡
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-border p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

/** Mobile Bottom Navigation Bar */
export function MobileBottomNav({ onOpenMore }: { onOpenMore?: () => void }) {
  const { userData } = useAuth();
  const userRole = userData?.role || 'cashier';

  // Primary mobile tabs curated based on assigned staff permissions
  const primaryTabs = [
    ...(userRole === 'admin' ? [{ name: 'Home', href: '/', icon: LayoutDashboard }] : []),
    ...(hasPermission(userData, 'pos') ? [{ name: 'POS', href: '/pos', icon: ShoppingCart }] : []),
    ...(hasPermission(userData, 'products') ? [{ name: 'Products', href: '/products', icon: Package }] : []),
    ...(hasPermission(userData, 'udhar') ? [{ name: 'Udhar', href: '/udhar', icon: CreditCard }] : []),
  ].slice(0, 4);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around px-1 py-1">
        {primaryTabs.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                'flex flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-1 min-w-[54px] transition-all duration-150 ' +
                (isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground')
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Icon className={'h-5 w-5' + (isActive ? ' text-primary scale-105' : '')} />
                  <span className="text-[10px] font-semibold leading-tight">{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}

        {/* More / All Features Drawer Button */}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-1 min-w-[54px] text-muted-foreground hover:text-foreground active:scale-95 transition-all"
        >
          <Menu className="h-5 w-5 text-amber-500" />
          <span className="text-[10px] font-semibold leading-tight text-foreground">More ☰</span>
        </button>
      </div>
    </nav>
  );
}

/** Mobile Full-Screen Menu Drawer */
export function MobileMoreMenu({ 
  isOpen, 
  onClose,
  unreadNotifs = 0
}: { 
  isOpen: boolean; 
  onClose: () => void;
  unreadNotifs?: number;
}) {
  const { userData, shopData, logout } = useAuth();
  const { canAccess } = usePlan();
  const allItems = navItems.filter(item => {
    if (userData?.role === 'admin') return true;
    if (item.permissionKey === 'notifications' || item.permissionKey === 'support') return true;
    return hasPermission(userData, item.permissionKey);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden animate-fadeIn" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="absolute right-0 top-0 bottom-0 w-72 bg-card border-l border-border shadow-2xl flex flex-col animate-slideInRight"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center shadow-sm">
              <img src="/favicon.svg" alt="MartGPT" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{shopData?.name || 'MartGPT'}</p>
              <p className="text-xs text-muted-foreground capitalize">{userData?.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {allItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  'nav-item ' + (isActive ? 'nav-item-active' : 'nav-item-inactive')
                }
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <Icon className={'h-4 w-4 flex-shrink-0 ' + (isActive ? 'text-white' : item.color)} />
                    <span className="truncate">{item.name}</span>
                    {item.href === '/notifications' && unreadNotifs > 0 && (
                      <span className="ml-auto text-[10px] font-black px-1.5 py-0.2 rounded-full bg-rose-500 text-white animate-pulse">
                        {unreadNotifs}
                      </span>
                    )}
                    {item.href === '/barcode-print' && !canAccess('barcode_print') && (
                      <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/20">
                        🔒 Plus
                      </span>
                    )}
                    {item.href === '/upgrade' && (
                      <span className="ml-auto text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
                        ⚡
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-border p-3">
          <button
            onClick={() => { logout(); onClose(); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
