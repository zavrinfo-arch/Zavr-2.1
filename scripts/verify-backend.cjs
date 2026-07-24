const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODMxMDIsImV4cCI6MjA5MTU1OTEwMn0.1vRwBZb3JInDYL5ee7fDiNCu5gXtKrmdLLFTTHwhRMU';

async function verifyDataPipeline() {
  console.log('--- VERIFYING BACKEND DATA PIPELINE ---');

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Check friend_requests table
  const { data: reqs, error: reqErr } = await supabase.from('friend_requests').select('*');
  console.log('friend_requests query:', { count: reqs?.length || 0, error: reqErr });

  // 2. Check friends table
  const { data: friends, error: frErr } = await supabase.from('friends').select('*');
  console.log('friends query:', { count: friends?.length || 0, error: frErr });

  console.log('--- PIPELINE CHECK COMPLETED ---');
}

verifyDataPipeline();
