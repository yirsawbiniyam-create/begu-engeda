import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './utils';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        setLoading(true);
      } else {
        setProfile(null);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      setLoading(true);
      // Special handling for Regional Police who don't register
      const adminEmails = [
        'policeregion551@gmail.com', 
        'yirsawbiniyam@gmail.com', 
        'sendeqbuild@gmail.com',
        'binimandelabb@gmail.com'
      ];
      
      if (user.email && adminEmails.includes(user.email)) {
        setProfile({
          fullName: 'Regional Police Admin / የክልል ፖሊስ ተቆጣጣሪ',
          role: 'regional_police',
          email: user.email,
          isVirtual: true
        });
        setLoading(false);
        setIsAuthReady(true);
        return;
      }

      const path = `users/${user.uid}`;
      const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        setProfile(doc.data() || null);
        setLoading(false);
        setIsAuthReady(true);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        setLoading(false);
        setIsAuthReady(true);
      });
      return () => unsubscribeProfile();
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
