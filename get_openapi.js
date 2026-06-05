import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('Fetching OpenAPI spec from:', `${url}/rest/v1/`);
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  
  if (!res.ok) {
    console.error('Failed to fetch OpenAPI:', res.status, res.statusText);
    return;
  }
  
  const data = await res.json();
  console.log('--- Exposed Tables and Functions ---');
  if (data.paths) {
    const paths = Object.keys(data.paths);
    console.log('Available paths:', paths.filter(p => !p.includes('{')));
  } else {
    console.log('No paths found');
  }
}

run();
