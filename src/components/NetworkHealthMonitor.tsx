import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function NetworkHealthMonitor() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSupabaseUp, setIsSupabaseUp] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkSupabaseHealth();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setIsSupabaseUp(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    
    const checkSupabaseHealth = async () => {
      if (!navigator.onLine) {
        setIsSupabaseUp(false);
        return;
      }
      
      setIsVerifying(true);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        await fetch('https://ivdkaccijoeitkrkmrkk.supabase.co/rest/v1/', {
          method: 'GET',
          headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODMxMDIsImV4cCI6MjA5MTU1OTEwMn0.1vRwBZb3JInDYL5ee7fDiNCu5gXtKrmdLLFTTHwhRMU' },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        setIsSupabaseUp(true);
      } catch (err) {
        setIsSupabaseUp(false);
      } finally {
        setIsVerifying(false);
      }
    };
    
    checkSupabaseHealth();
    
    const interval = setInterval(checkSupabaseHealth, 25000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const showReconnecting = !isOnline || !isSupabaseUp;

  return (
    <AnimatePresence>
      {showReconnecting && (
        <motion.div
          id="network-health-toast"
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm px-4 py-3 bg-[#FF6B6B]/90 text-white rounded-2xl flex items-center justify-between gap-3 shadow-2xl border border-white/20 backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl">
              {!isOnline ? (
                <WifiOff className="w-5 h-5 animate-pulse text-white/90" />
              ) : (
                <RefreshCw className="w-4 h-4 animate-spin text-white/90" />
              )}
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-[11px] leading-none mb-1">
                {!isOnline ? 'Offline' : 'Reconnecting...'}
              </p>
              <p className="text-[10px] opacity-80 leading-tight">
                {!isOnline ? 'Check your internet connection' : 'Attempting to contact Supabase server...'}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            disabled={isVerifying}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-[9px] font-bold uppercase tracking-[0.15em] rounded-xl transition-all quick-refresh"
          >
            Reload
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
