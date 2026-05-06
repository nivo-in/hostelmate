'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function StudentComplaints() {
  const [category, setCategory] = useState('electrical')
  const [description, setDescription] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [complaints, setComplaints] = useState<any[]>([])
  const [error, setError] = useState('')
  
  const { apiGet, apiPost } = useApi()
  const router = useRouter()
  const supabase = createClient()

  const fetchComplaints = async () => {
    const res = await apiGet('/api/complaints/my')
    if (res.success) setComplaints(res.data)
  }

  useEffect(() => {
    fetchComplaints()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return setError('Description required')
    
    const res = await apiPost('/api/complaints', { category, description, is_urgent: urgent })
    if (res.success) {
      setCategory('electrical')
      setDescription('')
      setUrgent(false)
      setError('')
      fetchComplaints()
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
      <Header title="Complaints" onSignOut={handleSignOut} />
      
      <div className="mb-10 p-6 border border-gray-100 rounded-xl">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs text-gray-900 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-gray-500">
              <option value="electrical">Electrical</option>
              <option value="plumbing">Plumbing</option>
              <option value="furniture">Furniture</option>
              <option value="cleaning">Cleaning</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-900 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm min-h-[100px] outline-none focus:border-gray-500" placeholder="Describe the issue..."></textarea>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="urgent" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            <label htmlFor="urgent" className="text-sm text-gray-900">Mark as Urgent</label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-700">Submit Complaint</button>
        </form>
      </div>

      <div>
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">My Complaints</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400">
              <th className="py-2">Date</th>
              <th className="py-2">Category</th>
              <th className="py-2">Description</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map(c => (
              <tr key={c.id} className="border-b border-gray-50">
                <td className="py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="py-3 text-gray-900 capitalize">{c.category}</td>
                <td className="py-3 text-gray-600 max-w-[200px] truncate" title={c.description}>
                  {c.is_urgent && <span className="mr-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">URGENT</span>}
                  {c.description}
                </td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${c.status === 'resolved' ? 'bg-green-50 text-green-700' : c.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    {c.status.replace('_', ' ').toUpperCase()}
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
