import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Use refs to stabilize references inside onAuthStateChange callback
  const sessionRef = React.useRef<Session | null>(null);
  const userRef = React.useRef<User | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const getCurrentUserId = () => {
    return user?.id || session?.user?.id || null;
  };

  useEffect(() => {
    console.log('[AUTH-CONTEXT] Registering AuthProvider onAuthStateChange listener...');
    
    // 1. Initial lookup
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user || null);
        console.log('[AUTH-CONTEXT] Initial session retrieved:', initialSession?.user?.id || 'No Session');
      } catch (err) {
        console.error('[AUTH-CONTEXT] Initial session fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Subscribe to auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[AUTH-CONTEXT] Auth state event: ${event}`);
      
      const prevUserId = userRef.current?.id || sessionRef.current?.user?.id;
      const nextUserId = currentSession?.user?.id;

      // Reset state / Prevent cross-user contamination
      if (prevUserId && nextUserId && prevUserId !== nextUserId) {
        console.warn('[AUTH-CONTEXT] User identity changed! Hard resetting all states to prevent leakage.');
        
        // Clear storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Soft reset states
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        // Force page reload to clear all in-memory states
        window.location.href = '/auth';
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user || null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        console.log('[AUTH-CONTEXT] User signed out, purging store cache.');
        localStorage.clear();
        sessionStorage.clear();
      }
    });

    return () => {
      console.log('[AUTH-CONTEXT] Cleaning up AuthProvider onAuthStateChange listener...');
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    console.log('[AUTH-CONTEXT] Clear all user data and signout...');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AUTH-CONTEXT] Supabase signout failed, proceeding with manual storage clear:', err);
    }

    // Force clear all local configurations, cache, app variables, state trackers
    localStorage.clear();
    sessionStorage.clear();

    // Reset local react state immediately
    setSession(null);
    setUser(null);

    // Redirect to login page hard so that ALL react state across the app is completely reset/purged
    window.location.href = '/auth';
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, logout, getCurrentUserId }}>
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
