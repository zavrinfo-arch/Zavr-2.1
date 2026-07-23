import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { supabaseRealtimeService } from '../services/supabaseRealtime';
import { toast } from 'react-hot-toast';

interface RefreshButtonProps {
  className?: string;
  showLabel?: boolean;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  className = '',
  showLabel = true,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { refreshData, fetchZettlData } = useStore();

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const toastId = toast.loading('Syncing latest data...');

    try {
      console.log('🔄 Triggering manual full app refresh...');
      // 1. Force WebSocket reconnect
      await supabaseRealtimeService.reconnect();

      // 2. Refresh main store data
      await refreshData();

      // 3. Refresh Zettl data
      if (fetchZettlData) {
        await fetchZettlData();
      }

      toast.success('App data up to date!', { id: toastId });
    } catch (err: any) {
      console.error('❌ Error during manual refresh:', err);
      toast.error('Failed to sync data. Please check connection.', { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all clay-btn ${className}`}
      title="Force data refresh & WebSocket reconnect"
    >
      <RefreshCw size={14} className={isRefreshing ? 'spin text-[#FF6B6B]' : 'text-foreground'} />
      {showLabel && <span>{isRefreshing ? 'Refreshing...' : 'Sync'}</span>}
    </button>
  );
};

export default RefreshButton;
