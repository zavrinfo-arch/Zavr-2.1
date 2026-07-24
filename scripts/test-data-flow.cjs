const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODMxMDIsImV4cCI6MjA5MTU1OTEwMn0.1vRwBZb3JInDYL5ee7fDiNCu5gXtKrmdLLFTTHwhRMU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectDataFlow() {
  console.log('=== INSPECTING DATA FLOW ===');

  // Query friends table
  const { data: friendsRows, error: friendsErr } = await supabase
    .from('friends')
    .select('*');
  
  console.log('friends table query result (anon client):', {
    count: friendsRows ? friendsRows.length : 0,
    error: friendsErr
  });

  // Query friend_requests table
  const { data: reqRows, error: reqErr } = await supabase
    .from('friend_requests')
    .select('*');

  console.log('friend_requests table query result (anon client):', {
    count: reqRows ? reqRows.length : 0,
    error: reqErr,
    rows: reqRows
  });
}

inspectDataFlow();
