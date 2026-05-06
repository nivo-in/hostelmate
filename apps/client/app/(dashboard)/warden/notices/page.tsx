'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function WardenNotices() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [audience, setAudience] = useState('all')
  const [notices, setNotices] = useState<any[]>([])
  const [error, setError] = useState('')
  
  const { apiGet, apiPost } = useApi()
  const router = useRouter()
  const supabase = createClient()

  const fetchNotices = async () => {
    const res = await apiGet('/api/notices')
    if (res.success) setNotices(res.data)
  }

  useEffect(() => {
    fetchNotices()
  }, [])

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !content) return setError('Title and content required')
    
    const res = await apiPost('/api/notices', { title, content, target_audience: audience })
    if (res.success) {
      setTitle('')
      setContent('')
      setAudience('all')
      setError('')
      fetchNotices()
    } else {
      setError(res.error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Notices" onSignOut={handleSignOut} />
      
      <div className="mb-10 p-6 border border-gray-100 rounded-xl">
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">Post New Notice</h2>
        <form onSubmit={handlePost} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs text-gray-900 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-900 mb-1">Content</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm min-h-[100px] outline-none focus:border-gray-500"></textarea>
          </div>
          <div>
            <label className="block text-xs text-gray-900 mb-1">Target Audience</label>
            <select value={audience} onChange={e => setAudience(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-gray-500">
              <option value="all">All</option>
              <option value="students">Students</option>
              <option value="parents">Parents</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-700">Post Notice</button>
        </form>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {notices.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No notices yet</div>
        ) : (
          notices.map(notice => (
            <div key={notice.id} className="p-6 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900">{notice.title}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">{notice.target_audience}</span>
                  <span className="text-xs text-gray-400">{new Date(notice.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{notice.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
