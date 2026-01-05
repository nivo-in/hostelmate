'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Notice } from '@/types'

export default function EmergencyAlert() {
  const router = useRouter()
  const supabase = createClient()
  
  const [message, setMessage] = useState('')
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState('')

  const fetchNotices = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) {
      setNotices(data.filter((n: Notice) => n.title?.includes('EMERGENCY')) || [])
    } else {
      setNotices([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchNotices()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSendAlert = async () => {
    if (!message.trim()) return
    
    if (!confirm('Are you sure? This will notify all students.')) {
      return
    }

    setSending(true)
    setSuccess('')
    
    // Optimistic UI update
    setNotices(prev => [{
      id: crypto.randomUUID(),
      title: 'EMERGENCY ALERT',
      content: message,
      created_at: new Date().toISOString(),
      target_audience: 'all',
      posted_by: 'warden'
    } as Notice, ...(prev || [])])
    
    try {
      const response = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'EMERGENCY ALERT',
          content: message,
          target_audience: 'all'
        }),
      })

      if (response.ok) {
        setSuccess('Alert sent to all students')
        setMessage('')
        // fetchNotices() // Commented to keep optimistic UI intact if backend isn't ready
      } else {
        alert('Failed to send alert.')
      }
    } catch (err) {
      alert('Error sending alert.')
    } finally {
      setSending(false)
      setTimeout(() => setSuccess(''), 5000)
    }
  }

  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    return `${Math.floor(diffInSeconds / 86400)} days ago`
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <PageHeader title="Emergency" showBack onSignOut={handleSignOut} />
      
      <div className="mb-12 mt-8">
        <div className="border border-red-200 rounded-xl p-8 bg-red-50/30">
          <div className="flex items-center gap-3 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-red-600"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            <h2 className="text-xl font-medium tracking-tight text-gray-900">Broadcast Emergency Alert</h2>
          </div>
          
          <textarea
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 mb-4 bg-white transition-colors"
            rows={4}
            placeholder="Type your emergency message here. Be clear and concise..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600/80">
              Warning: This will send an immediate notification to all students and staff.
            </p>
            <button
              onClick={handleSendAlert}
              disabled={sending || !message.trim()}
              className="bg-red-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Sending...' : 'Send Emergency Alert to All Students'}
            </button>
          </div>
          
          {success && (
            <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
              ✓ {success}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-medium tracking-tight text-gray-900 mb-6">Recent Emergency Alerts</h2>
        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-gray-400">Loading alerts...</div>
          ) : notices.length === 0 ? (
            <div className="text-sm text-gray-400">No emergency alerts sent.</div>
          ) : (
            notices.map((notice) => (
              <div key={notice.id} className="border border-red-100 rounded-xl p-6 hover:border-red-200 transition-colors bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <h3 className="font-medium text-gray-900">{notice.title}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    {timeAgo(notice.created_at)}
                  </div>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap ml-4">
                  {notice.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
