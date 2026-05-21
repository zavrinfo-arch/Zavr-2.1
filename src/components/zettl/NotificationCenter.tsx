import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, Check, X, ShieldAlert, BadgeInfo, Trophy, Flame, 
  Trash2, Landmark, Smartphone, Star 
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onPayRequest?: (id: string) => void;
}

export default function NotificationCenter({
  isOpen,
  onClose,
  onPayRequest
}: NotificationCenterProps) {
  const { 
    notifications, 
    markNotificationRead, 
    markAllNotificationsRead, 
    clearNotifications 
  } = useStore();

  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    toast.success('All marked as read');
  };

  const handleClearAll = () => {
    clearNotifications();
    toast.success('Clear complete');
  };

  const handleNotificationAction = (id: string, n: any) => {
    markNotificationRead(id);
    if (onPayRequest && (n.type === 'reminder' || n.title.includes('Request'))) {
      onPayRequest(n.data?.debtId || n.id);
      onClose();
    }
  };

  const getIconForNotification = (type: string) => {
    switch (type) {
      case 'streak':
        return <Flame size={14} className="text-orange-500" />;
      case 'achievement':
        return <Trophy size={14} className="text-yellow-500" />;
      case 'reminder':
        return <Landmark size={14} className="text-amber-500" />;
      case 'group':
        return <Star size={14} className="text-blue-500" />;
      default:
        return <BadgeInfo size={14} className="text-foreground/40" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-sm clay-card p-6 relative z-10 border-2 border-foreground/5 max-h-[85vh] overflow-y-auto no-scrollbar"
        id="notification-center-dropdown"
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-[#FF6B6B]" />
            <h3 className="text-base font-black italic">Alert Ledger</h3>
          </div>
          <button onClick={onClose} className="opacity-20 hover:opacity-100">
            <X size={20} />
          </button>
        </div>

        {/* Action Controls */}
        {notifications.length > 0 && (
          <div className="flex justify-between items-center mb-4 px-1">
            <button 
              onClick={handleMarkAllRead}
              className="text-[8px] font-black uppercase tracking-wider text-emerald-500 hover:underline"
            >
              Mark all read
            </button>
            <button 
              onClick={handleClearAll}
              className="text-[8px] font-black uppercase tracking-wider text-[#FF6B6B] hover:underline flex items-center gap-1"
            >
              <Trash2 size={10} /> Clear Logs
            </button>
          </div>
        )}

        {/* Notifications list */}
        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
          {notifications.length === 0 ? (
            <div className="py-12 text-center opacity-45 text-center">
              <p className="text-xs font-bold uppercase tracking-widest">No notifications to display</p>
              <p className="text-[9px] font-medium opacity-50 mt-1">Settle actions will trigger prompts here.</p>
            </div>
          ) : (
            <AnimatePresence>
              {notifications.map((n) => {
                const isMoneyRequest = n.type === 'reminder' || n.title.includes('Request');
                return (
                  <motion.div
                    key={n.id}
                    exit={{ opacity: 0, x: -10 }}
                    onClick={() => markNotificationRead(n.id)}
                    className={cn(
                      "clay-card p-3.5 flex items-start gap-3 border transition-all cursor-pointer",
                      n.read ? "opacity-60 border-foreground/5 bg-foreground/1" : "border-[#FF6B6B]/20 bg-[#FF6B6B]/1"
                    )}
                  >
                    <div className="w-8 h-8 rounded-xl clay-inset flex items-center justify-center bg-foreground/5 mt-0.5 flex-shrink-0">
                      {getIconForNotification(n.type)}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="text-xs font-black italic leading-tight">{n.title}</h4>
                        {!n.read && (
                          <span className="w-2 h-2 bg-[#FF6B6B] rounded-full inline-block flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[10px] text-foreground/60 leading-normal">{n.message}</p>
                      
                      <div className="flex justify-between items-center pt-1.5">
                        <span className="text-[8px] opacity-30 font-black uppercase tracking-wider">
                          {formatDistanceToNow(parseISO(n.timestamp || new Date().toISOString()), { addSuffix: true })}
                        </span>

                        {isMoneyRequest && !n.read && (
                          <div className="flex gap-1.5">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNotificationAction(n.id, n);
                              }}
                              className="px-2.5 py-1 bg-emerald-500 rounded-md text-[8px] text-white font-black uppercase tracking-widest"
                            >
                              PAY NOW
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationRead(n.id);
                              }}
                              className="px-2.5 py-1 bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-md text-[8px] font-black uppercase tracking-widest"
                            >
                              LATER
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

      </motion.div>
    </div>
  );
}
