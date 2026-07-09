import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODMxMDIsImV4cCI6MjA5MTU1OTEwMn0.1vRwBZb3JInDYL5ee7fDiNCu5gXtKrmdLLFTTHwhRMU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- CHECKING FRIEND REQUESTS ---');
  const { data, error } = await supabase
    .from('friend_requests')
    .insert({ sender_id: 'c4975581-4f83-4d9b-a104-27a7ae5d4cde', receiver_id: 'd18a3283-6099-4756-bc6a-ce51b1286026', status: 'pending' })
    .select();

  console.log('Result:', data);
  console.log('Error:', error);
}

check();
