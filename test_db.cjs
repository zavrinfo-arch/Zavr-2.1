const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4MzEwMiwiZXhwIjoyMDkxNTU5MTAyfQ.1odyQi-1cFuCXbj28AHzukMg-DPcSIHTmlFSqJyskMQ';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectColumns() {
  console.log('--- PROFILES COMPLETE SELECT TEST ---');
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log('Success fetching first profile!');
    if (data && data.length > 0) {
      console.log('Profile columns:', Object.keys(data[0]));
      console.log('Profile record:', data[0]);
    } else {
      console.log('No profiles found, but query succeeded.');
    }
  }
}

inspectColumns();
