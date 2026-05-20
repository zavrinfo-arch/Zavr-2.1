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
        headers: { 'x-application-name': 'zavr-app' },
        fetch: async (url, options = {}) => {
          const controller = new AbortController();
          
          // Auth operations like signup involve external SMTP, password hashing, and user triggers
          // that are notoriously slow. Let's allow 15 seconds for auth endpoints to prevent AbortError
          // and rate-limiting, and keep a fast 3 seconds for all other queries.
          const urlStr = typeof url === 'string' ? url : '';
          const isAuthEndpoint = urlStr.includes('/auth/v1/');
          const timeoutLimit = isAuthEndpoint ? 15000 : 3000;

          const timeoutId = setTimeout(() => controller.abort(), timeoutLimit);

          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal
            });
            return response;
          } catch (error: any) {
            if (error?.name === 'AbortError') {
              console.error(`[SUPABASE CLIENT] Request timed out after ${timeoutLimit / 1000} seconds: ${url}`);
              throw new Error('Request timed out');
            }
            throw error;
          } finally {
            clearTimeout(timeoutId);
          }
        }
      },
      realtime: {
        timeout: 40000,
        heartbeatIntervalMs: 30000,
        reconnectAfterMs: (retries) => {
          const delay = Math.min(1000 * Math.pow(2, retries), 30000);
          return delay;
        }
      }
    });
  }
  return supabaseInstance;
};

export const supabase = getSupabaseClient();
export const isConfigured = true;
