import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODMxMDIsImV4cCI6MjA5MTU1OTEwMn0.1vRwBZb3JInDYL5ee7fDiNCu5gXtKrmdLLFTTHwhRMU';

// Singleton instance
let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    if (typeof window === 'undefined') {
      // Server-side fallback or minimal client for SSR if needed
      return createClient(supabaseUrl, supabaseAnonKey);
    }

    console.log('[SUPABASE] Creating new singleton client instance');
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'zavr-auth-token',
        storage: window.localStorage,
        // Disable auth locking to prevent "Lock broken by another request with the 'steal' option" errors
        // specifically common in development/HMR environments and non-standard browser contexts.
        // We use an exhaustive argument finder to handle different GoTrue versions (name, acquire) vs (name, timeout, acquire).
        lock: (...args: any[]) => {
          const acquire = args.find(arg => typeof arg === 'function');
          if (acquire) {
            return acquire();
          }
          return Promise.resolve();
        } 
      },
      global: {
        headers: { 'x-application-name': 'zavr-app' }
      }
    });
  }
  return supabaseInstance;
};

export const supabase = getSupabaseClient();
export const isConfigured = true;
