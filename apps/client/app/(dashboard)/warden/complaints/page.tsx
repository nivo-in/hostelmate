'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function WardenComplaints() {
  const [filter, setFilter] = useState('All')
  const [complaints, setComplaints] = useState<any[]>([])
  const { apiGet, apiPatch } = useApi()
  const router = useRouter()
  const supabase = createClient()

  const fetchComplaints = async () => {
    const url = filter === 'All' ? '/api/complaints/all' : `/api/complaints/all?status=${filter.toLowerCase().replace(' ', '_')}`
    const res = await apiGet(url)
    if (res.success) setComplaints(res.data)
  }

  useEffect(() => {
    fetchComplaints()
  }, [filter])

  const handleStatusChange = async (id: string, status: string) => {
    const res = await apiPatch(`/api/complaints/${id}/status`, { status })
    if (res.success) fetchComplaints()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Complaints" onSignOut={handleSignOut} />
      
      <div className="flex gap-4 mb-6">
        {['All', 'Open', 'In Progress', 'Resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr className="text-gray-400">
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Student</th>
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium">Description</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map(c => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-6 py-4 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-gray-900">
                  {c.students?.profiles?.full_name || 'N/A'}<br/>
                  <span className="text-xs text-gray-400">{c.students?.roll_number}</span>
                </td>
                <td className="px-6 py-4 text-gray-900 capitalize">{c.category}</td>
                <td className="px-6 py-4 text-gray-600 max-w-[200px]">
                  {c.is_urgent && <span className="block mb-1 text-[10px] font-bold bg-red-100 text-red-700 px-1 rounded w-fit">URGENT</span>}
                  <p className="truncate" title={c.description}>{c.description}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${c.status === 'resolved' ? 'bg-green-50 text-green-700' : c.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    {c.status.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 space-y-2">
                  {c.status === 'open' && (
                    <button onClick={() => handleStatusChange(c.id, 'in_progress')} className="block w-full px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">In Progress</button>
                  )}
                  {c.status !== 'resolved' && (
                    <button onClick={() => handleStatusChange(c.id, 'resolved')} className="block w-full px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">Resolve</button>
                  )}
                </td>
              </tr>
            ))}
            {complaints.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No complaints found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
