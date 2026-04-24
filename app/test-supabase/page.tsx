'use client';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';

export default function TestSupabasePage() {
  const [status, setStatus] = useState('PENDING');
  const [errorMsg, setErrorMsg] = useState('');
  const url = 'https://ivdkaccijoeitkrkmrkk.supabase.co';

  useEffect(() => {
    async function test() {
      const supabase = createClient();
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          setStatus('FAILED');
          setErrorMsg(error.message);
        } else {
          setStatus('SUCCESS');
        }
      } catch (e: any) {
        setStatus('ERROR');
        setErrorMsg(e.message);
      }
    }
    test();
  }, []);

  const blurredUrl = url.replace(/(https?:\/\/)(.{4})(.*)/, '$1$2****$3');

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Supabase Connection Test</h1>
      <p>Project URL: <code>{blurredUrl}</code></p>
      <div style={{
        padding: 20,
        borderRadius: 8,
        backgroundColor: status === 'SUCCESS' ? '#dcfce7' : '#fee2e2',
        color: status === 'SUCCESS' ? '#166534' : '#991b1b',
        fontWeight: 'bold',
        fontSize: '1.2rem'
      }}>
        Status: {status}
      </div>
      {errorMsg && (
        <div style={{ marginTop: 20, padding: 10, border: '1px solid red' }}>
          <strong>Error Details:</strong>
          <pre>{errorMsg}</pre>
        </div>
      )}
      <button 
        onClick={() => window.location.reload()}
        style={{ marginTop: 20, padding: '10px 20px', cursor: 'pointer' }}
      >
        Retry Test
      </button>
    </div>
  );
}
