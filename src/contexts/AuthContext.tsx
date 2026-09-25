import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
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

  return (
    <AuthContext.Provider value={{ user, userData, shopData, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
