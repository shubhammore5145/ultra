import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
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
    let shopUnsubscribe: (() => void) | undefined;
    let userUnsubscribe: (() => void) | undefined;

    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          
          if (userUnsubscribe) userUnsubscribe();
          
          userUnsubscribe = onSnapshot(userDocRef, (userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data() as UserData;
              setUserData(data);
              
              if (data.shopId) {
                const shopDocRef = doc(db, 'shops', data.shopId);
                if (shopUnsubscribe) shopUnsubscribe();
                
                shopUnsubscribe = onSnapshot(shopDocRef, async (shopDoc) => {
                  if (shopDoc.exists()) {
                    const sData = shopDoc.data() as Shop;
                    
                    if (sData.plan === 'pro' && sData.planExpiry) {
                      if (new Date(sData.planExpiry) < new Date()) {
                        try {
                          await updateDoc(shopDocRef, {
                            plan: 'free',
                            planExpiry: deleteField()
                          });
                          sData.plan = 'free';
                          sData.planExpiry = undefined;
                        } catch (e) {
                          console.error("Failed to downgrade expired plan:", e);
                        }
                      }
                    }
                    
                    setShopData({ shopId: shopDoc.id, ...sData });
                  }
                  setLoading(false);
                });
              } else {
                setLoading(false);
              }
            }
            // If it doesn't exist yet (during signup), we just wait for the next snapshot.
          });
        } catch (error) {
          console.error('Error fetching user data:', error);
          setLoading(false);
        }
      } else {
        setUserData(null);
        setShopData(null);
        if (shopUnsubscribe) shopUnsubscribe();
        if (userUnsubscribe) userUnsubscribe();
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (shopUnsubscribe) shopUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, shopData, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
