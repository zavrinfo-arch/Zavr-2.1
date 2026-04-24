import { createBrowserClient } from '@supabase/ssr'

const getEnv = (name: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return import.meta.env[name];
  }
  return undefined;
};

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODMxMDIsImV4cCI6MjA5MTU1OTEwMn0.1vRwBZb3JInDYL5ee7fDiNCu5gXtKrmdLLFTTHwhRMU';

export function createClient() {
  if (!url || !anonKey) {
     console.error('Supabase keys missing - createBrowserClient will fail');
  }
  return createBrowserClient(url!, anonKey!)
}

export const isConfigured = !!(url && !url.includes('placeholder'));
