const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4MzEwMiwiZXhwIjoyMDkxNTU5MTAyfQ.1odyQi-1cFuCXbj28AHzukMg-DPcSIHTmlFSqJyskMQ';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function test() {
  console.log('Testing Supabase connection...');
  try {
    // Query a row from profiles
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(1);
    console.log('Profiles select results:', { profiles, pError });

    // Query a row from user_profiles
    const { data: userProfiles, error: upError } = await supabase.from('user_profiles').select('*').limit(1);
    console.log('User Profiles select results:', { userProfiles, upError });
  } catch (err) {
    console.error('Exception:', err);
  }
}

test();
