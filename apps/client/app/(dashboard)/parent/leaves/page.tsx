'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function ParentLeaves() {
  const [leaves, setLeaves] = useState<any[]>([])
  const { apiGet } = useApi()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    apiGet('/api/leaves/my').then(res => {
      if (res.success) setLeaves(res.data)
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Leave Status" onSignOut={handleSignOut} />
      
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr className="text-gray-400">
              <th className="px-6 py-3 font-medium">Start</th>
              <th className="px-6 py-3 font-medium">End</th>
              <th className="px-6 py-3 font-medium">Reason</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Applied on</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map(l => (
              <tr key={l.id} className="border-t border-gray-100">
                <td className="px-6 py-4 text-gray-900">{l.start_date}</td>
                <td className="px-6 py-4 text-gray-900">{l.end_date}</td>
                <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={l.reason}>{l.reason}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${l.status === 'approved' ? 'bg-green-50 text-green-700' : l.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {l.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{new Date(l.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {leaves.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No leave requests found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
