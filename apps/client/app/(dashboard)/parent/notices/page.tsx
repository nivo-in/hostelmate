'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function ParentNotices() {
  const [notices, setNotices] = useState<any[]>([])
  
  const { apiGet } = useApi()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    apiGet('/api/notices').then(res => {
      if (res.success) setNotices(res.data)
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Notices" onSignOut={handleSignOut} />
      
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {notices.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No notices yet</div>
        ) : (
          notices.map(notice => (
            <div key={notice.id} className="p-6 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900">{notice.title}</h3>
                <span className="text-xs text-gray-400">{new Date(notice.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{notice.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
