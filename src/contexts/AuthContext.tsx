import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { auth, signOut } from '../lib/firebase';
import type { UserData, Shop } from '../types';

interface AuthContextType {
  user: any; // We just store the decoded user representation
  userData: UserData | null;
  shopData: Shop | null;
  loading: boolean;
  login: (token: string, user: UserData, shop?: Shop) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  shopData: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [userData, setUserData] = useState<UserData | null>(() => {
    try {
      const raw = localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [shopData, setShopData] = useState<Shop | null>(() => {
    try {
      const raw = localStorage.getItem('auth_shop');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Helper to ensure shopData is always available if shop or user has shopId
  const resolveShop = (u: any, s?: any): Shop | null => {
    if (s && s.shopId) return s;
    const fallbackId = s?.shopId || u?.shopId;
    if (!fallbackId) return null;
    return {
      shopId: fallbackId,
      name: s?.name || (u?.displayName ? `${u.displayName} चे किराणा` : 'माझे किराणा स्टोअर'),
      ownerName: s?.ownerName || u?.displayName || 'दुकानदार',
      phone: s?.phone || '',
      email: s?.email || u?.email || '',
      address: s?.address || '',
      plan: s?.plan || 'ultra_pro',
      createdAt: s?.createdAt || new Date().toISOString()
    } as any;
  };

  const login = (token: string, u: UserData, s?: Shop) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(u));
    setUser(u);
    setUserData(u);
    const resolvedShop = resolveShop(u, s);
    if (resolvedShop) {
      setShopData(resolvedShop);
      localStorage.setItem('auth_shop', JSON.stringify(resolvedShop));
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_shop');
    try {
      signOut(auth);
    } catch (_e) {}
    setUser(null);
    setUserData(null);
    setShopData(null);
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const res = await api.auth.me();
          setUser(res.user);
          setUserData(res.user);
          localStorage.setItem('auth_user', JSON.stringify(res.user));
          const resolvedShop = resolveShop(res.user, res.shop);
          if (resolvedShop) {
            setShopData(resolvedShop);
            localStorage.setItem('auth_shop', JSON.stringify(resolvedShop));
          }
        } catch (error) {
          console.error('Session expired or invalid:', error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-300">MartGPT सुरू होत आहे...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userData, shopData, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
