import { supabase, isConfigured as configStatus } from '../../src/lib/supabaseClient';

export function createClient() {
  return supabase;
}

export const isConfigured = configStatus;

