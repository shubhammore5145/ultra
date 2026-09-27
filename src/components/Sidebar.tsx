import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Package, Users, CreditCard,
  FileText, Settings, ArrowLeftRight, Wallet, Crown,
  HelpCircle, ClipboardList, LogOut, Store, Menu, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin'], color: 'text-indigo-500' },
  { name: 'POS Billing', href: '/pos', icon: ShoppingCart, roles: ['admin', 'cashier'], color: 'text-emerald-500' },
  { name: 'Products', href: '/products', icon: Package, roles: ['admin', 'cashier'], color: 'text-blue-500' },
  { name: 'Inventory & AI', href: '/inventory', icon: ClipboardList, roles: ['admin', 'cashier'], color: 'text-purple-500' },
  { name: 'Customers', href: '/customers', icon: Users, roles: ['admin', 'cashier'], color: 'text-cyan-500' },
  { name: 'Udhar Book', href: '/udhar', icon: CreditCard, roles: ['admin', 'cashier'], color: 'text-rose-500' },
  { name: 'Purchases', href: '/purchases', icon: ArrowLeftRight, roles: ['admin'], color: 'text-orange-500' },
  { name: 'Expenses', href: '/expenses', icon: Wallet, roles: ['admin'], color: 'text-amber-500' },
  { name: 'Reports', href: '/reports', icon: FileText, roles: ['admin'], color: 'text-teal-500' },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'], color: 'text-slate-500' },
  { name: 'Upgrade', href: '/upgrade', icon: Crown, roles: ['admin'], color: 'text-yellow-500' },
  { name: 'Support', href: '/support', icon: HelpCircle, roles: ['admin', 'cashier'], color: 'text-green-500' },
];

/** Desktop Sidebar */
export function Sidebar() {
  const { userData, shopData, logout } = useAuth();
  const userRole = userData?.role || 'cashier';
  const filteredNav = navItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="flex h-full w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/30">
          <Store className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground leading-tight">{shopData?.name || 'KiranaPro'}</p>
          <p className="text-xs text-muted-foreground capitalize">{userData?.role || 'Admin'}</p>
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
                  <span>{item.name}</span>
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
export function MobileBottomNav() {
  const { userData } = useAuth();
  const userRole = userData?.role || 'cashier';
  const mobileNavItems = navItems
    .filter(item => item.roles.includes(userRole))
    .slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1.5">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                'flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 min-w-[56px] transition-all duration-200 ' +
                (isActive ? 'text-primary' : 'text-muted-foreground')
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Icon className={'h-5 w-5' + (isActive ? ' text-primary' : '')} />
                  <span className="text-[10px] font-semibold leading-tight">{item.name.split(' ')[0]}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

/** Mobile Full-Screen Menu Drawer */
export function MobileMoreMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { userData, shopData, logout } = useAuth();
  const userRole = userData?.role || 'cashier';
  const allItems = navItems.filter(item => item.roles.includes(userRole));

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
            <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{shopData?.name || 'KiranaPro'}</p>
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
                    <span>{item.name}</span>
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
