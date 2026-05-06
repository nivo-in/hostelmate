'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function StudentLeaves() {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [leaves, setLeaves] = useState<any[]>([])
  const [error, setError] = useState('')
  
  const { apiGet, apiPost } = useApi()
  const router = useRouter()
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  const fetchLeaves = async () => {
    const res = await apiGet('/api/leaves/my')
    if (res.success) setLeaves(res.data)
  }

  useEffect(() => {
    fetchLeaves()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.length < 20) return setError('Reason must be at least 20 chars')
    
    const res = await apiPost('/api/leaves', { start_date: start, end_date: end, reason })
    if (res.success) {
      setStart('')
      setEnd('')
      setReason('')
      setError('')
      fetchLeaves()
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
      <Header title="Leave Requests" onSignOut={handleSignOut} />
      
      <div className="mb-10 p-6 border border-gray-100 rounded-xl">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-900 mb-1">Start Date</label>
              <input type="date" min={today} value={start} onChange={e => setStart(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-900 mb-1">End Date</label>
              <input type="date" min={start || today} value={end} onChange={e => setEnd(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-900 mb-1">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm min-h-[100px]" placeholder="Detailed reason..."></textarea>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-700">Apply Leave</button>
        </form>
      </div>

      <div>
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">My Leaves</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400">
              <th className="py-2">Start</th>
              <th className="py-2">End</th>
              <th className="py-2">Reason</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map(l => (
              <tr key={l.id} className="border-b border-gray-50">
                <td className="py-3 text-gray-900">{l.start_date}</td>
                <td className="py-3 text-gray-900">{l.end_date}</td>
                <td className="py-3 text-gray-600">{l.reason.substring(0, 40)}{l.reason.length > 40 ? '...' : ''}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${l.status === 'approved' ? 'bg-green-50 text-green-700' : l.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {l.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
