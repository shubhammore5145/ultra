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
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [shopData, setShopData] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  const login = (token: string, u: UserData, s?: Shop) => {
    localStorage.setItem('auth_token', token);
    setUser(u); // minimal user
    setUserData(u);
    if (s) setShopData(s);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
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
          if (res.shop) {
            setShopData(res.shop);
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
          <p className="text-sm font-medium text-slate-300">KiranaPro सुरू होत आहे...</p>
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
