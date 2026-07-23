import React, { useState, useEffect } from 'react';
import { useSupabaseStatus } from '../hooks/useSupabaseStatus';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import '../styles/connection.css';

interface ConnectionStatusProps {
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ className = '' }) => {
  const { status, isConnected, retryCount, reconnect } = useSupabaseStatus();
  const [isVisible, setIsVisible] = useState(true);
  const [isManualConnecting, setIsManualConnecting] = useState(false);

  useEffect(() => {
    if (isConnected) {
      // Auto-hide after 5 seconds when connected
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      // Always show when not connected (connecting, reconnecting, disconnected)
      setIsVisible(true);
    }
  }, [isConnected, status]);

  const handleManualReconnect = async () => {
    setIsManualConnecting(true);
    try {
      await reconnect();
    } finally {
      setIsManualConnecting(false);
    }
  };

  if (!isVisible && isConnected) {
    return null;
  }

  return (
    <div className={`connection-status-bar connection-status-${status} ${className}`}>
      <div className="connection-status-content">
        <div className="connection-status-indicator">
          <span className={`status-dot status-dot-${status}`} />
          {status === 'connected' && <CheckCircle2 className="status-icon text-emerald-500" size={14} />}
          {status === 'connecting' && <RefreshCw className="status-icon spin text-amber-500" size={14} />}
          {status === 'reconnecting' && <RefreshCw className="status-icon spin text-amber-500" size={14} />}
          {status === 'disconnected' && <WifiOff className="status-icon text-red-500" size={14} />}
        </div>

        <div className="connection-status-text">
          {status === 'connected' && <span className="font-semibold">Realtime Connected</span>}
          {status === 'connecting' && <span>Connecting to Realtime...</span>}
          {status === 'reconnecting' && (
            <span>
              Reconnecting to Realtime... <strong className="ml-1">({retryCount}/10)</strong>
            </span>
          )}
          {status === 'disconnected' && <span>Realtime Disconnected</span>}
        </div>

        {status === 'disconnected' && (
          <button
            onClick={handleManualReconnect}
            disabled={isManualConnecting}
            className="connection-reconnect-btn"
            title="Reconnect Realtime"
          >
            <RefreshCw size={12} className={isManualConnecting ? 'spin' : ''} />
            <span>Reconnect</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;
