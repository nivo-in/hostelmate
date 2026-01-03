'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function WardenLeaves() {
  const [filter, setFilter] = useState('All')
  const [leaves, setLeaves] = useState<any[]>([])
  const { apiGet, apiPatch } = useApi()
  const router = useRouter()
  const supabase = createClient()

  const fetchLeaves = async () => {
    const res = await apiGet('/api/leaves/pending') 
    if (res.success) {
      setLeaves(res.data)
    }
  }

  useEffect(() => {
    fetchLeaves()
  }, [])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const res = await apiPatch(`/api/leaves/${id}/${action}`, {})
    if (res.success) {
      fetchLeaves()
    }
  }

  const filteredLeaves = leaves.filter(l => filter === 'All' || l.status.toLowerCase() === filter.toLowerCase())

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Leave Management" onSignOut={handleSignOut} />
      
      <div className="flex gap-4 mb-6">
        {['All', 'Pending', 'Approved', 'Rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr className="text-gray-400">
              <th className="px-6 py-3 font-medium">Student Name</th>
              <th className="px-6 py-3 font-medium">Roll No</th>
              <th className="px-6 py-3 font-medium">Start</th>
              <th className="px-6 py-3 font-medium">End</th>
              <th className="px-6 py-3 font-medium">Reason</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeaves.map(l => (
              <tr key={l.id} className="border-t border-gray-100">
                <td className="px-6 py-4 text-gray-900">{l.students?.profiles?.full_name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{l.students?.roll_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-900">{l.start_date}</td>
                <td className="px-6 py-4 text-gray-900">{l.end_date}</td>
                <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={l.reason}>{l.reason}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${l.status === 'approved' ? 'bg-green-50 text-green-700' : l.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {l.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 space-x-2">
                  {l.status === 'pending' && (
                    <>
                      <button onClick={() => handleAction(l.id, 'approve')} className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">Approve</button>
                      <button onClick={() => handleAction(l.id, 'reject')} className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filteredLeaves.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No leaves found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
