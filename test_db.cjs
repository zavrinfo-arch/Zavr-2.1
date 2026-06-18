const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4MzEwMiwiZXhwIjoyMDkxNTU5MTAyfQ.1odyQi-1cFuCXbj28AHzukMg-DPcSIHTmlFSqJyskMQ';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectColumns() {
  console.log('--- PROFILES SAFE SELECT TEST ---');
  const verifiedColumns = [
    'id', 'full_name', 'username', 'email', 'phone', 'birth_date', 'dob',
    'avatar_url', 'avatar_id', 'onboarding_completed', 'created_at', 'last_login_at'
  ];
  const { data, error } = await supabase
    .from('profiles')
    .select(verifiedColumns.join(','))
    .limit(1);
  if (error) {
    console.error('Error fetching safe select fields from profiles:', error);
  } else {
    console.log('Success fetching safe select fields!');
    console.log('Profile record:', data);
  }
}

inspectColumns();
