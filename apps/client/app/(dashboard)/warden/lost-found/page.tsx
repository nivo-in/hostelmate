'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function WardenLostFound() {
  const [filter, setFilter] = useState('All')
  const [items, setItems] = useState<any[]>([])
  const { apiGet, apiPatch } = useApi()
  const router = useRouter()
  const supabase = createClient()

  const fetchItems = async () => {
    const url = filter === 'All' ? '/api/lost-found' : `/api/lost-found?status=${filter.toLowerCase()}`
    const res = await apiGet(url)
    if (res.success) setItems(res.data)
  }

  useEffect(() => {
    fetchItems()
  }, [filter])

  const handleClaim = async (id: string) => {
    const res = await apiPatch(`/api/lost-found/${id}/claim`, {})
    if (res.success) fetchItems()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Lost & Found" onSignOut={handleSignOut} />
      
      <div className="flex gap-4 mb-6">
        {['All', 'Lost', 'Found', 'Claimed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr className="text-gray-400">
              <th className="px-6 py-3 font-medium">Item</th>
              <th className="px-6 py-3 font-medium">Description</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Location</th>
              <th className="px-6 py-3 font-medium">Reported By</th>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-gray-100">
                <td className="px-6 py-4 text-gray-900 font-medium">{item.item_name}</td>
                <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={item.description}>{item.description}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-medium ${item.status === 'lost' ? 'bg-red-50 text-red-700' : item.status === 'found' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{item.location_found}</td>
                <td className="px-6 py-4 text-gray-900">{item.profiles?.full_name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(item.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  {item.status !== 'claimed' && (
                    <button onClick={() => handleClaim(item.id)} className="px-3 py-1 bg-gray-900 text-white rounded text-xs hover:bg-gray-700">Mark Claimed</button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No items found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
