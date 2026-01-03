'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function StudentLostFound() {
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('lost')
  const [location, setLocation] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [error, setError] = useState('')
  
  const { apiGet, apiPost } = useApi()
  const router = useRouter()
  const supabase = createClient()

  const fetchItems = async () => {
    const res = await apiGet('/api/lost-found')
    if (res.success) setItems(res.data || [])
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName || !description || !location) return setError('All fields required')
    
    // Optimistic UI update
    setItems(prev => [{
      id: crypto.randomUUID(),
      item_name: itemName,
      description,
      status,
      location_found: location,
      created_at: new Date().toISOString()
    }, ...(prev || [])])

    const res = await apiPost('/api/lost-found', { item_name: itemName, description, status, location_found: location })
    if (res.success) {
      setItemName('')
      setDescription('')
      setStatus('lost')
      setLocation('')
      setError('')
      // fetchItems() // Commented to keep optimistic UI intact if backend isn't ready
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
      <Header title="Lost & Found" onSignOut={handleSignOut} />
      
      <div className="mb-10 p-6 border border-gray-100 rounded-xl">
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">Report Item</h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div className="flex gap-4 mb-4">
            <button type="button" onClick={() => setStatus('lost')} className={`flex-1 py-2 rounded-lg text-sm ${status === 'lost' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}>I Lost Something</button>
            <button type="button" onClick={() => setStatus('found')} className={`flex-1 py-2 rounded-lg text-sm ${status === 'found' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}>I Found Something</button>
          </div>
          <div>
            <label className="block text-xs text-gray-900 mb-1">Item Name</label>
            <input value={itemName} onChange={e => setItemName(e.target.value)} type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-900 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm min-h-[80px] outline-none focus:border-gray-500"></textarea>
          </div>
          <div>
            <label className="block text-xs text-gray-900 mb-1">Location {status === 'lost' ? 'Lost' : 'Found'}</label>
            <input value={location} onChange={e => setLocation(e.target.value)} type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-700">Submit Report</button>
        </form>
      </div>

      <div>
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">All Items Directory</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item.id} className="p-4 border border-gray-100 rounded-xl bg-white hover:border-gray-300 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900">{item.item_name}</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium ${item.status === 'lost' ? 'bg-red-50 text-red-700' : item.status === 'found' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">{item.description}</p>
              <div className="text-xs text-gray-400 flex flex-col gap-1">
                <span>📍 {item.location_found}</span>
                <span>📅 {new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="col-span-3 p-8 text-center text-sm text-gray-500 border border-gray-100 rounded-xl">No items reported</div>}
        </div>
      </div>
    </div>
  )
}
