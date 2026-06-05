import * as React from 'react';
import { createContext, useContext } from 'react';
import { useStore } from '../store/useStore';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
  getCurrentUserId: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, currentUser, isAuthLoading, signOut } = useStore();

  const getCurrentUserId = () => {
    return currentUser?.id || session?.user?.id || null;
  };

  const logout = async () => {
    await signOut();
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user: session?.user || null, 
        session, 
        loading: isAuthLoading, 
        logout, 
        getCurrentUserId 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
