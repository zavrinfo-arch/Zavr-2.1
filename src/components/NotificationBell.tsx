import React, { useState, useRef, useEffect } from 'react';
import { useZettlContext } from '../context/ZettlContext';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, Trash2, Calendar, ShieldCheck, Heart, CircleAlert, Sparkles } from 'lucide-react';

export default function NotificationBell() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useZettlContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment':
      case 'achievement':
        return <ShieldCheck className="text-emerald-400 shrink-0" size={14} />;
      case 'request':
      case 'reminder':
        return <CircleAlert className="text-amber-400 shrink-0" size={14} />;
      default:
        return <Heart className="text-purple-400 shrink-0" size={14} />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 clay-inset flex items-center justify-center text-foreground/70 relative cursor-pointer"
      >
        <Bell size={18} className="text-purple-400" />
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#FF6B6B] rounded-full animate-ping" />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 max-h-[420px] overflow-hidden rounded-2xl shadow-2xl border border-foreground/10 bg-[#120F1D]/95 backdrop-blur-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-foreground/5 bg-foreground/2 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Alert Hub</h4>
                <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest">{unreadCount} active updates</p>
              </div>
              
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllNotificationsRead()}
                  className="text-[8px] font-black uppercase tracking-widest text-[#FF6B6B] hover:opacity-85"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto no-scrollbar max-h-80 divide-y divide-foreground/5">
              {notifications.length === 0 ? (
                <div className="p-8 text-center opacity-30 flex flex-col items-center justify-center">
                  <Sparkles size={24} className="mb-2 text-purple-400" />
                  <p className="text-[9px] font-bold uppercase tracking-widest leading-relaxed">No new alerts tracked</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3.5 flex gap-3 items-start transition-all ${
                      notif.read ? 'opacity-50' : 'bg-purple-600/5'
                    }`}
                  >
                    {getNotificationIcon(notif.type)}
                    
                    <div className="flex-1 min-w-0">
                      <h5 className="text-[10px] font-black italic block text-foreground truncate">{notif.title}</h5>
                      <span className="text-[9.5px] opacity-70 text-foreground break-words leading-relaxed mt-0.5 block">{notif.message}</span>
                      <span className="text-[7px] text-foreground/30 font-bold block uppercase tracking-wider mt-1.5 flex items-center gap-1">
                        <Calendar size={10} /> {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {!notif.read && (
                      <button
                        onClick={() => markNotificationRead(notif.id)}
                        className="rounded-full w-5 h-5 bg-foreground/5 border border-foreground/5 hover:bg-purple-600/20 flex items-center justify-center shrink-0 transition-all cursor-pointer"
                        title="Mark read"
                      >
                        <Check size={10} className="text-purple-400" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
