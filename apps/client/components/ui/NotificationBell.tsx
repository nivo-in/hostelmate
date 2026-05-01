'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { Notification } from '@/types';
import { toast } from 'sonner';
import { 
  Bell, Check, Trash2, X, Search,
  Palmtree, Wrench, Megaphone, Siren, ClipboardCheck,
  CreditCard, UtensilsCrossed, PackageSearch
} from 'lucide-react';

/**
 * Computes a human-readable relative time string (e.g. '3m ago', '2h ago')
 * from a past ISO date string.
 *
 * @param {string} dateString - Past timestamp in ISO format
 * @returns {string} Relative time difference string
 */
function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) {return interval + 'y ago';}
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) {return interval + 'mths ago';}
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) {return interval + 'd ago';}
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) {return interval + 'h ago';}
  interval = Math.floor(seconds / 60);
  if (interval >= 1) {return interval + 'm ago';}
  return Math.floor(seconds) + 's ago';
}

/**
 * Returns a React Lucide icon element configured with custom color
 * and size appropriate for the notification classification category.
 *
 * @param {string} type - Notification category type
 * @param {string} color - SVG stroke color code
 * @returns {React.ReactElement}
 */
const getIconForType = (type: string, color: string) => {
  const props = { size: 16, color };
  switch (type) {
    case 'leave': return <Palmtree {...props} />;
    case 'complaint': return <Wrench {...props} />;
    case 'notice': return <Megaphone {...props} />;
    case 'emergency': return <Siren {...props} />;
    case 'attendance': return <ClipboardCheck {...props} />;
    case 'payment':
    case 'fee': return <CreditCard {...props} />;
    case 'mess': return <UtensilsCrossed {...props} />;
    case 'lost-found': return <PackageSearch {...props} />;
    default: return <Bell {...props} />;
  }
};

const getThemeTokens = (pathname: string) => {
  if (pathname?.startsWith('/student')) {
    return {
      primary: '#fb923c', // Orange
      primaryLight: '#fdba74',
      bgGlow: 'rgba(251, 146, 60, 0.15)',
      border: 'rgba(251, 146, 60, 0.3)',
      bgSoft: 'rgba(251, 146, 60, 0.08)',
      bgHover: 'rgba(251, 146, 60, 0.12)',
      gradient: 'linear-gradient(135deg, rgba(251,146,60,0.2) 0%, rgba(251,146,60,0) 100%)',
    };
  }
  if (pathname?.startsWith('/parent')) {
    return {
      primary: '#60a5fa', // Parent Blue (matches dashboard accent)
      primaryLight: '#bfdbfe',
      bgGlow: 'rgba(96, 165, 250, 0.15)',
      border: 'rgba(96, 165, 250, 0.3)',
      bgSoft: 'rgba(96, 165, 250, 0.08)',
      bgHover: 'rgba(96, 165, 250, 0.12)',
      gradient: 'linear-gradient(135deg, rgba(96,165,250,0.2) 0%, rgba(96,165,250,0) 100%)',
    };
  }
  // Default to Warden (Purple)
  return {
    primary: '#7c5cfc', // Purple
    primaryLight: '#a78bfa',
    bgGlow: 'rgba(124, 92, 252, 0.15)',
    border: 'rgba(124, 92, 252, 0.3)',
    bgSoft: 'rgba(124, 92, 252, 0.08)',
    bgHover: 'rgba(124, 92, 252, 0.12)',
    gradient: 'linear-gradient(135deg, rgba(124,92,252,0.2) 0%, rgba(124,92,252,0) 100%)',
  };
};

export function NotificationBell() {
  const pathname = usePathname();
  const theme = getThemeTokens(pathname ?? '');
  
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => setMounted(true), []);

  const { apiGet, apiPatch, apiDelete } = useApi();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNotifications = useCallback(async (currentPage = 1) => {
    try {
      const res = await apiGet(`/api/v1/notifications?page=${currentPage}&limit=20`);
      if (res.success) {
        if (currentPage === 1) {
          setNotifications(res.data.notifications);
        } else {
          setNotifications((prev) => {
            const newNotifs = res.data.notifications.filter(
              (n: Notification) => !prev.some((p) => p.id === n.id)
            );
            return [...prev, ...newNotifs];
          });
        }
        setUnreadCount(res.data.unread_count);
        setHasNext(res.pagination?.hasNext || false);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [apiGet]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) {clearTimeout(debounceRef.current);}
    debounceRef.current = setTimeout(() => {
      fetchNotifications();
    }, 2000);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications(1);
    const intervalId = setInterval(() => fetchNotifications(1), 300000);
    return () => {
      clearInterval(intervalId);
      if (debounceRef.current) {clearTimeout(debounceRef.current);}
    };
  }, [fetchNotifications]);

  useSocket({
    'notice:new': (_data: unknown) => {
      const data = _data as { message?: string };
      debouncedFetch();
      toast('New Notice', { description: data?.message || 'A new notice was posted.' });
    },
    'leave:updated': (_data: unknown) => {
      const data = _data as { message?: string };
      debouncedFetch();
      toast('Leave Request Updated', { description: data?.message || 'Your leave request status changed.' });
    },
    'complaint:updated': (_data: unknown) => {
      const data = _data as { message?: string };
      debouncedFetch();
      toast('Complaint Updated', { description: data?.message || 'A complaint was updated.' });
    },
    'attendance:marked': (_data: unknown) => {
      const data = _data as { message?: string };
      debouncedFetch();
      toast('Attendance Marked', { description: data?.message || 'Attendance has been recorded.' });
    },
    'notification:new': (_data: unknown) => {
      const data = _data as { title?: string; message?: string };
      debouncedFetch();
      toast(data?.title || 'New Notification', { description: data?.message || 'You have a new notification.' });
    },
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setPage(1);
      fetchNotifications(1);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {setIsOpen(false);}
    };
    if (isOpen) {document.addEventListener('keydown', handleKeyDown);}
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      await apiPatch('/api/v1/notifications/read-all', {});
    } catch {
      fetchNotifications();
    }
  };

  const handleNotificationClick = async (id: string, isRead: boolean) => {
    if (isRead) {return;}
    try {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await apiPatch(`/api/v1/notifications/${id}/read`, {});
    } catch {
      fetchNotifications();
    }
  };

  const handleDismiss = async (e: React.MouseEvent, id: string, isRead: boolean) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!isRead) {setUnreadCount((prev) => Math.max(0, prev - 1));}
    try {
      await apiDelete(`/api/v1/notifications/${id}`);
    } catch {
      fetchNotifications();
    }
  };

  return (
    <>
      <style>{`
        @keyframes bellRing {
          0% { transform: rotate(0); }
          15% { transform: rotate(15deg); }
          30% { transform: rotate(-10deg); }
          45% { transform: rotate(5deg); }
          60% { transform: rotate(-3deg); }
          75% { transform: rotate(1deg); }
          100% { transform: rotate(0); }
        }
        .bell-trigger:hover .bell-icon-anim { animation: bellRing 0.6s ease-in-out; }
        .bell-icon-anim { transform-origin: top center; }
        
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        .notif-panel-open {
          animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .notif-panel-closed {
          animation: slideOutRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .notif-scrollbar::-webkit-scrollbar { width: 4px; }
        .notif-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .notif-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .notif-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="bell-trigger relative p-2 rounded-xl transition-all duration-300 focus:outline-none flex items-center justify-center"
        style={{ 
          color: unreadCount > 0 ? theme.primaryLight : 'rgba(255,255,255,0.45)',
          background: unreadCount > 0 ? theme.bgSoft : 'transparent',
          boxShadow: unreadCount > 0 ? `0 0 12px ${theme.bgGlow}` : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = theme.primaryLight;
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = unreadCount > 0 ? theme.primaryLight : 'rgba(255,255,255,0.45)';
          e.currentTarget.style.background = unreadCount > 0 ? theme.bgSoft : 'transparent';
        }}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5 bell-icon-anim" strokeWidth={2} />
        
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg border border-[#0a0a0f]"
            style={{ 
              background: theme.primary, 
              color: '#fff',
              boxShadow: `0 0 10px ${theme.bgGlow}`
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Portal */}
      {mounted && createPortal(
        <div 
          className="fixed inset-0 z-50 pointer-events-none flex justify-end"
          style={{ visibility: isOpen ? 'visible' : 'hidden', transition: 'visibility 0.4s' }}
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 pointer-events-auto ${
              isOpen ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ 
              background: 'rgba(0,0,0,0.4)', 
              backdropFilter: 'blur(4px)', 
              WebkitBackdropFilter: 'blur(4px)' 
            }}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            role="dialog"
            aria-modal="true"
            className={`relative w-full max-w-sm h-full pointer-events-auto flex flex-col ${
              isOpen ? 'notif-panel-open' : 'notif-panel-closed'
            }`}
            style={{
              background: 'rgba(14, 14, 22, 0.75)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              borderLeft: '1px solid rgba(255,255,255,0.06)',
              boxShadow: `-20px 0 80px rgba(0,0,0,0.6), inset 1px 0 0 rgba(255,255,255,0.02)`,
            }}
          >
            {/* Ambient Top Glow */}
            <div 
              className="absolute top-0 left-0 right-0 h-32 pointer-events-none opacity-40"
              style={{ background: theme.gradient }}
            />

            {/* Header */}
            <div 
              className="relative h-16 px-6 flex items-center justify-between shrink-0 z-10"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
                  style={{ background: theme.bgSoft, border: `1px solid ${theme.border}` }}
                >
                  <Bell size={16} color={theme.primaryLight} />
                </div>
                <h2 className="text-base font-semibold text-white/90 tracking-wide">
                  Notifications
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all duration-200"
                    style={{ color: theme.primaryLight, background: theme.bgSoft }}
                    onMouseEnter={(e) => e.currentTarget.style.background = theme.bgHover}
                    onMouseLeave={(e) => e.currentTarget.style.background = theme.bgSoft}
                  >
                    <Check size={12} strokeWidth={2.5} />
                    Mark all read
                  </button>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200"
                  style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Quick Search Filter */}
            {notifications.length > 0 && (
              <div className="px-5 pt-3 pb-1 z-10 shrink-0">
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-white/30" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notifications…"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-1.5 pl-9 pr-7 text-xs text-white placeholder-white/30 outline-none focus:border-white/25 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 text-white/40 hover:text-white/80"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Content List */}
            <div className="notif-scrollbar flex-1 overflow-y-auto relative z-10 p-4 space-y-3">
              {loading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-white/5 shrink-0" />
                        <div className="h-3 rounded bg-white/5 w-1/3" />
                      </div>
                      <div className="h-2 rounded bg-white/5 w-full mb-2 ml-11" />
                      <div className="h-2 rounded bg-white/5 w-2/3 ml-11" />
                    </div>
                  ))}
                </>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 opacity-60">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border border-white/10"
                    style={{ background: 'rgba(255,255,255,0.02)', boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.02)' }}
                  >
                    <Bell size={28} className="text-white/20" />
                  </div>
                  <p className="text-sm font-medium text-white/70">No notifications yet</p>
                  <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
                    When you get notifications, they&apos;ll show up here.
                  </p>
                </div>
              ) : (
                (() => {
                  const filtered = notifications.filter((n) => {
                    if (!searchQuery.trim()) {return true;}
                    const q = searchQuery.toLowerCase();
                    return (
                      n.title?.toLowerCase().includes(q) ||
                      n.message?.toLowerCase().includes(q) ||
                      n.type?.toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center px-6 opacity-60">
                        <p className="text-xs font-medium text-white/70">No matching notifications</p>
                        <p className="text-[11px] text-white/40 mt-1">Try searching for a different keyword</p>
                      </div>
                    );
                  }

                  return filtered.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                    className="group relative p-4 rounded-2xl cursor-pointer transition-all duration-300 border"
                    style={{
                      background: notification.is_read ? 'rgba(255,255,255,0.02)' : theme.bgSoft,
                      borderColor: notification.is_read ? 'rgba(255,255,255,0.05)' : theme.border,
                      boxShadow: notification.is_read ? 'none' : `0 4px 20px -2px ${theme.bgGlow}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.background = notification.is_read ? 'rgba(255,255,255,0.04)' : theme.bgHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.background = notification.is_read ? 'rgba(255,255,255,0.02)' : theme.bgSoft;
                    }}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Icon */}
                      <div 
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                        style={{ 
                          background: notification.is_read ? 'rgba(255,255,255,0.05)' : theme.bgSoft,
                          border: `1px solid ${notification.is_read ? 'rgba(255,255,255,0.08)' : theme.border}`
                        }}
                      >
                        {getIconForType(notification.type ?? '', notification.is_read ? 'rgba(255,255,255,0.6)' : theme.primaryLight)}
                      </div>
                      
                      {/* Text content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p 
                            className="text-[13px] font-semibold truncate" 
                            style={{ color: notification.is_read ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.95)' }}
                          >
                            {notification.title}
                          </p>
                          <span className="text-[10px] font-medium whitespace-nowrap pt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {timeAgo(notification.created_at)}
                          </span>
                        </div>
                        <p 
                          className="text-[12px] leading-relaxed line-clamp-2"
                          style={{ color: notification.is_read ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)' }}
                        >
                          {notification.message}
                        </p>
                      </div>
                    </div>

                    {/* Unread dot indicator */}
                    {!notification.is_read && (
                      <div 
                        className="absolute top-4 -left-1.5 w-3 h-3 rounded-full border-2 border-[#0e0e16]"
                        style={{ background: theme.primary, boxShadow: `0 0 8px ${theme.primary}` }}
                      />
                    )}

                    {/* Hover actions (Delete) */}
                    <button
                      onClick={(e) => handleDismiss(e, notification.id, notification.is_read)}
                      className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-md hover:bg-red-500/10 hover:text-red-400 text-white/30"
                      title="Remove notification"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ));
                })()
              )}

              {hasNext && !loading && (
                <div className="pt-2 pb-4 flex justify-center">
                  <button
                    onClick={() => {
                      const nextPage = page + 1;
                      setPage(nextPage);
                      fetchNotifications(nextPage);
                    }}
                    className="text-xs font-semibold px-4 py-2 rounded-full transition-all duration-200 border"
                    style={{ 
                      color: 'rgba(255,255,255,0.6)', 
                      background: 'rgba(255,255,255,0.03)',
                      borderColor: 'rgba(255,255,255,0.08)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    Load earlier notifications
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
