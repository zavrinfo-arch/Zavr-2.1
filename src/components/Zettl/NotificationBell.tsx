import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useZettlContext } from '../../context/ZettlContext';
import { Bell, CheckCheck, Landmark, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';

export default function NotificationBell() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useZettlContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unreadCount = notifications.filter(n => !n.read).length;

  // Auto close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: any) => {
    try {
      await markNotificationRead(notif.id);
    } catch (e) {
      // safe bypass
    }

    // Try parsing deep link data to navigate straight to friend's chat
    try {
      if (notif.data) {
        const parsed = JSON.parse(notif.data);
        if (parsed.senderId) {
          navigate(`/zettl/chat/${parsed.senderId}`);
        } else if (parsed.debtId) {
          // If the notification has a debtId, lookup who requested it 
          // Let's go to Zettl Chat overall list first or try to navigate to /zettl
          navigate('/zettl');
        }
      } else {
        navigate('/zettl');
      }
    } catch (err) {
      navigate('/zettl');
    }
    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'request':
        return <ShieldAlert className="text-amber-400 shrink-0" size={14} />;
      case 'payment':
        return <Landmark className="text-emerald-400 shrink-0" size={14} />;
      default:
        return <UserCheck className="text-purple-400 shrink-0" size={14} />;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Button Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 relative flex items-center justify-center cursor-pointer transition-colors border border-slate-800"
        title="Ledger Notifications"
      >
        <Bell size={18} className="text-purple-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-black font-mono animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown body */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-72 bg-slate-900 border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col">
          {/* Dropdown Header */}
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Activity Bell</h4>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{unreadCount} unread notices</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-[9px] font-black text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck size={12} /> Clear all
              </button>
            )}
          </div>

          {/* List update panels */}
          <div className="max-h-64 overflow-y-auto no-scrollbar divide-y divide-slate-800/40">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center space-y-2 opacity-50">
                <Sparkles size={18} className="mx-auto text-purple-400 animate-spin" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">No new alerts tracked</p>
              </div>
            ) : (
              notifications.map((notif: any) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 text-left hover:bg-slate-800/30 transition-colors cursor-pointer flex gap-2.5 items-start ${
                    notif.read ? 'opacity-40' : 'bg-purple-950/5'
                  }`}
                >
                  {getIcon(notif.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-200 leading-tight">{notif.title}</p>
                    <p className="text-[9.5px] text-slate-400 mt-0.5 leading-snug line-clamp-2">{notif.message}</p>
                    <span className="text-[7.5px] text-slate-600 font-mono block mt-1 uppercase tracking-wider">
                      {new Date(notif.timestamp || notif.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
