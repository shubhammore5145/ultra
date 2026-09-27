import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, Store, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar, MobileBottomNav, MobileMoreMenu } from './Sidebar';

export default function Layout() {
  const { userData, shopData, logout } = useAuth();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of KiranaPro?')) {
      logout();
      navigate('/login');
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
                {shopData?.name || 'KiranaPro'}
              </span>
            </div>

            {/* Desktop breadcrumb placeholder */}
            <div className="hidden md:block text-sm text-muted-foreground">
              Welcome back, <span className="font-semibold text-foreground">{userData?.displayName || 'User'}</span>
            </div>
          </div>

          {/* Right: Actions & Logout */}
          <div className="flex items-center gap-2">
            {/* Desktop User Info & Logout Button */}
            <div className="hidden md:flex items-center gap-3 border-l border-border pl-4 ml-2">
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

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-4 pb-24 md:p-6 md:pb-6 max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Mobile Drawer Menu */}
      <MobileMoreMenu isOpen={moreMenuOpen} onClose={() => setMoreMenuOpen(false)} />
    </div>
  );
}
