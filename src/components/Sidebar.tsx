import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  CreditCard,
  FileText,
  Settings,
  ArrowLeftRight,
  Wallet,
  Crown,
  HelpCircle,
  ClipboardList
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'POS Billing', href: '/pos', icon: ShoppingCart, roles: ['admin', 'cashier'] },
  { name: 'Products', href: '/products', icon: Package, roles: ['admin', 'cashier'] },
  { name: 'Inventory & AI', href: '/inventory', icon: ClipboardList, roles: ['admin', 'cashier'] },
  { name: 'Customers', href: '/customers', icon: Users, roles: ['admin', 'cashier'] },
  { name: 'Udhar Book', href: '/udhar', icon: CreditCard, roles: ['admin', 'cashier'] },
  { name: 'Purchases', href: '/purchases', icon: ArrowLeftRight, roles: ['admin'] },
  { name: 'Expenses', href: '/expenses', icon: Wallet, roles: ['admin'] },
  { name: 'Reports', href: '/reports', icon: FileText, roles: ['admin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
  { name: 'Support', href: '/support', icon: HelpCircle, roles: ['admin', 'cashier'] },
];

/** Desktop Sidebar */
export function Sidebar() {
  const { userData } = useAuth();
  const userRole = userData?.role || 'cashier';

  const filteredNav = navItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="flex h-full w-64 flex-col overflow-y-auto border-r bg-card">
      <nav className="flex-1 space-y-1 px-2 py-4">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'group flex items-center rounded-md px-2 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <Icon className={cn("mr-3 h-5 w-5 flex-shrink-0", item.name.includes('Upgrade') && "text-yellow-500")} aria-hidden="true" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

/** Mobile Bottom Navigation Bar */
export function MobileBottomNav() {
  const { userData } = useAuth();
  const userRole = userData?.role || 'cashier';

  // Show only the most important items on mobile bottom bar
  const mobileNavItems = navItems
    .filter(item => item.roles.includes(userRole))
    .slice(0, 5); // Max 5 items for bottom nav

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="flex items-center justify-around px-1 py-1">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 min-w-[60px] transition-all duration-200',
                  isActive
                    ? 'text-primary bg-primary/10 scale-105'
                    : 'text-muted-foreground hover:text-foreground active:scale-95'
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium leading-tight">{item.name.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

/** Mobile "More" Menu for items that don't fit in bottom nav */
export function MobileMoreMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { userData } = useAuth();
  const userRole = userData?.role || 'staff';

  const allItems = navItems.filter(item => item.roles.includes(userRole));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div 
        className="absolute bottom-16 left-4 right-4 bg-card rounded-2xl border shadow-2xl p-4 animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-4 gap-3">
          {allItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 transition-all',
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )
                }
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
                <span className="text-[11px] font-medium leading-tight text-center">{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}
