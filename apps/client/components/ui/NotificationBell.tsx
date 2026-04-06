'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { Notification } from '@/types';
import { toast } from 'sonner';

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + 'y ago';
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + 'mo ago';
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + 'd ago';
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + 'h ago';
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + 'm ago';
  return Math.floor(seconds) + 's ago';
}

const TYPE_DOT: Record<string, string> = {
  leave: 'bg-blue-500',
  complaint: 'bg-orange-500',
  notice: 'bg-purple-500',
  emergency: 'bg-red-500',
  attendance: 'bg-green-500',
  curfew: 'bg-yellow-500',
  lost_found: 'bg-gray-400',
};

function typeDot(type: string) {
  const color = TYPE_DOT[type] ?? 'bg-gray-400';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 mt-0.5 ${color}`}
      aria-hidden="true"
    />
  );
}

// Unread-row accent follows the role's theme (warden purple, student orange, parent blue).
const ACCENTS = {
  student: { line: '#fb923c', bg: 'rgba(251,146,60,0.10)', bgHover: 'rgba(251,146,60,0.15)' },
  parent: { line: '#60a5fa', bg: 'rgba(96,165,250,0.10)', bgHover: 'rgba(96,165,250,0.15)' },
  warden: { line: '#7c5cfc', bg: 'rgba(124,92,252,0.08)', bgHover: 'rgba(124,92,252,0.13)' },
};

export function NotificationBell() {
  const pathname = usePathname();
  const accent = pathname?.startsWith('/student')
    ? ACCENTS.student
    : pathname?.startsWith('/parent')
      ? ACCENTS.parent
      : ACCENTS.warden;
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  // Portal target only exists in the browser — gate render until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { apiGet, apiPatch, apiDelete } = useApi();
  // Ref to track pending debounce timer for socket-triggered fetches
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (currentPage = 1) => {
    try {
      const res = await apiGet(`/api/v1/notifications?page=${currentPage}&limit=20`);
      if (res.success) {
        if (currentPage === 1) {
          setNotifications(res.data.notifications);
        } else {
          setNotifications((prev) => {
            // Deduplicate if any overlapping updates
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
      // Silently fail — never surface polling errors to UI
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced version for socket events — prevents rapid-fire fetches
  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchNotifications();
    }, 2000); // 2s debounce: bursts of socket events → single fetch
  }, [fetchNotifications]);

  useEffect(() => {
    // Fetch immediately on mount
    fetchNotifications(1);

    // Fallback poll every 5 minutes (WebSocket handles real-time updates)
    const intervalId = setInterval(() => {
      fetchNotifications(1);
    }, 300000);

    return () => {
      clearInterval(intervalId);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchNotifications]);

  // WebSocket: refresh on any real-time event (debounced to avoid rapid API calls)
  useSocket({
    'notice:new': (_data: unknown) => {
      const data = _data as { message?: string };
      debouncedFetch();
      toast('New Notice', { description: data?.message || 'A new notice was posted.' });
    },
    'leave:updated': (_data: unknown) => {
      const data = _data as { message?: string };
      debouncedFetch();
      toast('Leave Request Updated', {
        description: data?.message || 'Your leave request status changed.',
      });
    },
    'complaint:updated': (_data: unknown) => {
      const data = _data as { message?: string };
      debouncedFetch();
      toast('Complaint Updated', { description: data?.message || 'A complaint was updated.' });
    },
    'attendance:marked': (_data: unknown) => {
      const data = _data as { message?: string };
      debouncedFetch();
      toast('Attendance Marked', {
        description: data?.message || 'Attendance has been recorded.',
      });
    },
    'notification:new': (_data: unknown) => {
      const data = _data as { title?: string; message?: string };
      debouncedFetch();
      toast(data?.title || 'New Notification', {
        description: data?.message || 'You have a new notification.',
      });
    },
  });

  // ── Panel open / close side-effects ───────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Always refresh the list when the panel is opened so it never shows a
      // stale or empty body (e.g. if the mount fetch failed or raced).
      setPage(1);
      fetchNotifications(1);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // ── Actions ────────────────────────────────────────────────────────────────
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
    if (isRead) return;
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
    // Optimistically remove from UI
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!isRead) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await apiDelete(`/api/v1/notifications/${id}`);
    } catch {
      fetchNotifications();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Bell trigger button ─────────────────────────────────────────── */}
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
        .bell-trigger .bell-icon-anim { transform-origin: top center; }
        .bell-trigger:hover .bell-icon-anim { animation: bellRing 0.6s ease-in-out; }
      `}</style>
      <button
        onClick={() => setIsOpen(true)}
        className="bell-trigger relative p-2 rounded-full transition-colors focus:outline-none"
        style={{ color: 'rgba(255,255,255,0.45)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 bell-icon-anim"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Overlay + panel are portaled to <body> so they escape the PageHeader's
          backdrop-filter stacking context (which would otherwise trap these
          fixed elements inside the header bar on feature pages). */}
      {mounted &&
        createPortal(
          <>
            {/* ── Overlay ─────────────────────────────────────────────────── */}
            <div
              className={`fixed inset-0 z-40 transition-opacity duration-300 ${
                isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

      {/* ── Slide-in panel ──────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notifications panel"
        className={`fixed top-0 right-0 h-full w-96 max-w-full z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: '#0c0c14',
          borderLeft: '0.5px solid rgba(255,255,255,0.1)',
          boxShadow: '-24px 0 60px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Panel header */}
        <div
          className="h-16 px-5 flex items-center justify-between shrink-0"
          style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}
        >
          <span className="text-base font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Notifications
          </span>

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs transition-colors cursor-pointer"
                style={{ color: 'rgba(255,255,255,0.45)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
              >
                Mark all read
              </button>
            )}

            {/* X close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                e.currentTarget.style.background = 'transparent';
              }}
              aria-label="Close notifications"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            /* Loading skeletons */
            <>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="px-5 py-4 animate-pulse"
                  style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="h-3 rounded w-2/3 mb-2" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div className="h-2 rounded w-full mb-1.5" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="h-2 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>
              ))}
            </>
          ) : notifications.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-12 h-12 mb-3"
                style={{ color: 'rgba(255,255,255,0.12)' }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No notifications yet</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{"You're all caught up!"}</p>
            </div>
          ) : (
            /* Notification items */
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                className="group relative px-5 py-4 cursor-pointer transition-colors"
                style={{
                  borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                  borderLeft: notification.is_read ? '2px solid transparent' : `2px solid ${accent.line}`,
                  background: notification.is_read ? 'transparent' : accent.bg,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = notification.is_read
                    ? 'rgba(255,255,255,0.03)'
                    : accent.bgHover)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = notification.is_read
                    ? 'transparent'
                    : accent.bg)
                }
              >
                {/* Top row: dot + title + time + dismiss */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {typeDot(notification.type ?? '')}
                    <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {notification.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {timeAgo(notification.created_at)}
                    </span>
                    {/* Dismiss button — visible only on row hover */}
                    <button
                      onClick={(e) => handleDismiss(e, notification.id, notification.is_read)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-4 h-4 flex items-center justify-center rounded"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                      aria-label="Dismiss notification"
                      title="Dismiss"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Message */}
                <p
                  className="text-xs mt-1 leading-relaxed line-clamp-2 pl-4"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  {notification.message}
                </p>
              </div>
            ))
          )}

          {hasNext && !loading && (
            <div className="p-4 flex justify-center" style={{ borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  fetchNotifications(nextPage);
                }}
                className="text-xs font-medium transition-colors"
                style={{ color: 'rgba(255,255,255,0.45)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
              >
                Load older
              </button>
            </div>
          )}
        </div>
      </div>
          </>,
          document.body
        )}
    </>
  );
}
