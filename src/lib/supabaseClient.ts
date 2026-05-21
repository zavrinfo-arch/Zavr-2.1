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
          const urlStr = typeof url === 'string' ? url : '';
          const isAuthEndpoint = urlStr.includes('/auth/v1/');
          // Allow up to 10 seconds for standard queries and 20 seconds for slow auth operations (with SMTP triggers)
          const timeoutLimit = isAuthEndpoint ? 20000 : 10000;
          
          const maxRetries = isAuthEndpoint ? 1 : 3;
          let lastError: any = null;

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutLimit);

            try {
              const response = await fetch(url, {
                ...options,
                signal: controller.signal
              });
              
              // Retry on bad gateway / Gateway Timeout / Service Unavailable
              if (response.status >= 502 && response.status <= 504 && attempt < maxRetries - 1) {
                const backoff = Math.pow(2, attempt) * 1000;
                console.warn(`[SUPABASE CLIENT] Received HTTP ${response.status}. Retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                continue;
              }

              return response;
            } catch (error: any) {
              lastError = error;
              const isTimeout = error?.name === 'AbortError';

              if (attempt < maxRetries - 1) {
                const backoff = Math.pow(2, attempt) * 1000;
                console.warn(`[SUPABASE CLIENT] Attempt ${attempt + 1} failed with ${isTimeout ? 'Timeout' : 'Error'}. Retrying in ${backoff}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                continue;
              }
              
              if (isTimeout) {
                console.error(`[SUPABASE CLIENT] Request timed out after ${timeoutLimit / 1000} seconds (max retries reached): ${url}`);
                throw new Error('Supabase request timed out');
              }
            } finally {
              clearTimeout(timeoutId);
            }
          }
          throw lastError || new Error('Request failed');
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
