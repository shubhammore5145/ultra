import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserData, Shop } from '../types';

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  shopData: Shop | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  shopData: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [shopData, setShopData] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            setUserData(data);
            
            if (data.shopId) {
              const shopDocRef = doc(db, 'shops', data.shopId);
              const shopDoc = await getDoc(shopDocRef);
              if (shopDoc.exists()) {
                setShopData({ shopId: shopDoc.id, ...shopDoc.data() } as Shop);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserData(null);
        setShopData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, shopData, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
