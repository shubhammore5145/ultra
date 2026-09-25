import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
// Firebase removed
import { LogOut, Store, Menu } from 'lucide-react';
import { Sidebar, MobileBottomNav, MobileMoreMenu } from './Sidebar';

export default function Layout() {
  const { userData, shopData, logout } = useAuth();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      {/* Top Nav Bar */}
      <nav className="shrink-0 border-b bg-card px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="rounded-md bg-primary/10 p-1.5 md:p-2">
              <Store className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <span className="text-lg md:text-xl font-bold text-foreground truncate max-w-[150px] md:max-w-none">
              {shopData?.name || 'KiranaPro'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Show user info only on desktop */}
            <div className="hidden md:block text-sm">
              <p className="font-medium text-foreground">
                {userData?.displayName}
              </p>
              <p className="text-muted-foreground capitalize">
                {userData?.role}
              </p>
            </div>
            
            {/* More menu button on mobile */}
            <Button 
              variant="outline" 
              size="icon" 
              className="md:hidden h-9 w-9"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            >
              <Menu className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="sm" onClick={handleLogout} className="h-9">
              <LogOut className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 md:block">
          <Sidebar />
        </aside>

        {/* Main Content - add bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto bg-muted/20 p-3 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Mobile More Menu */}
      <MobileMoreMenu isOpen={moreMenuOpen} onClose={() => setMoreMenuOpen(false)} />
    </div>
  );
}
