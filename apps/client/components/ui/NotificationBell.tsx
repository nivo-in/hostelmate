'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { Notification } from '@/types'

function timeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  let interval = Math.floor(seconds / 31536000)
  if (interval >= 1) return interval + 'y ago'
  interval = Math.floor(seconds / 2592000)
  if (interval >= 1) return interval + 'mo ago'
  interval = Math.floor(seconds / 86400)
  if (interval >= 1) return interval + 'd ago'
  interval = Math.floor(seconds / 3600)
  if (interval >= 1) return interval + 'h ago'
  interval = Math.floor(seconds / 60)
  if (interval >= 1) return interval + 'm ago'
  return Math.floor(seconds) + 's ago'
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const { apiGet, apiPatch } = useApi()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiGet('/api/notifications')
      if (res.success) {
        setNotifications(res.data.notifications)
        setUnreadCount(res.data.unread_count)
      }
    } catch {
      // Silently fail — never surface polling errors to UI
    } finally {
      setLoading(false)
    }
  }, [apiGet])

  useEffect(() => {
    // 2-second delay on mount so it doesn't block initial render
    const mountDelay = setTimeout(async () => {
      try {
        await fetchNotifications()
      } catch {
        // Silently fail
      }
    }, 2000)

    // Poll every 2 minutes after first fetch
    const intervalId = setInterval(async () => {
      try {
        await fetchNotifications()
      } catch {
        // Silently fail
      }
    }, 120000)

    return () => {
      clearTimeout(mountDelay)
      clearInterval(intervalId)
    }
  }, [fetchNotifications])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMarkAllRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
      await apiPatch('/api/notifications/read-all', {})
    } catch {
      fetchNotifications()
    }
  }

  const handleNotificationClick = async (id: string, isRead: boolean) => {
    if (isRead) return

    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
      await apiPatch(`/api/notifications/${id}/read`, {})
    } catch {
      fetchNotifications()
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-50 focus:outline-none"
        aria-label="Notifications"
      >
        {/* Bell SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
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
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-8 w-96 bg-white border border-gray-200 rounded-xl z-50 overflow-hidden shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[32rem] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex flex-col gap-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No notifications
              </div>
            ) : (
              <div>
                {notifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      notification.is_read
                        ? 'bg-white hover:bg-gray-50'
                        : 'bg-gray-50/50 border-l-2 border-gray-900 hover:bg-gray-100'
                    } ${index < notifications.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1.5">{timeAgo(notification.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
