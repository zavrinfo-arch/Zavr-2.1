const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4MzEwMiwiZXhwIjoyMDkxNTU5MTAyfQ.1odyQi-1cFuCXbj28AHzukMg-DPcSIHTmlFSqJyskMQ';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectColumns() {
  console.log('--- EMERGENCY GOALS TEST ---');
  const { error: errCategory } = await supabase.from('emergency_goals').select('category').limit(1);
  console.log('emergency_goals.category error:', errCategory);

  const { error: errDeadline } = await supabase.from('emergency_goals').select('deadline').limit(1);
  console.log('emergency_goals.deadline error:', errDeadline);

  console.log('\n--- GROUP GOALS TEST ---');
  const { error: errMembers } = await supabase.from('group_goals').select('members').limit(1);
  console.log('group_goals.members error:', errMembers);

  const { error: errGrpCategory } = await supabase.from('group_goals').select('category').limit(1);
  console.log('group_goals.category error:', errGrpCategory);
}

inspectColumns();
