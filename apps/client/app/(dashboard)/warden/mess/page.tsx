'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function WardenMess() {
  const [day, setDay] = useState('monday')
  const [mealType, setMealType] = useState('breakfast')
  const [items, setItems] = useState('')
  const [menu, setMenu] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  
  const { apiGet, apiPut } = useApi()
  const router = useRouter()
  const supabase = createClient()

  const fetchMenu = async () => {
    const res = await apiGet('/api/mess/menu')
    if (res.success) setMenu(res.data)
  }

  const fetchReviews = async () => {
    const res = await apiGet('/api/mess/reviews')
    if (res.success) setReviews(res.data)
  }

  useEffect(() => {
    fetchMenu()
    fetchReviews()
  }, [])

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!items.trim()) return setError('Items are required')
    
    const itemsList = items.split(',').map(i => i.trim()).filter(Boolean)
    const res = await apiPut('/api/mess/menu', { day_of_week: day, meal_type: mealType, items: itemsList })
    if (res.success) {
      setItems('')
      setMessage('Menu updated successfully')
      setError('')
      fetchMenu()
      setTimeout(() => setMessage(''), 3000)
    } else {
      setError(res.error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const meals = ['breakfast', 'lunch', 'snacks', 'dinner']

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Mess Management" onSignOut={handleSignOut} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <div className="p-6 border border-gray-100 rounded-xl">
          <h2 className="font-medium tracking-tight text-gray-900 mb-4">Edit Menu</h2>
          <form onSubmit={handleSaveMenu} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-900 mb-1">Day</label>
              <select value={day} onChange={e => setDay(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-gray-500">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => (
                  <option key={d} value={d} className="capitalize">{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-900 mb-1">Meal</label>
              <select value={mealType} onChange={e => setMealType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-gray-500">
                {meals.map(m => (
                  <option key={m} value={m} className="capitalize">{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-900 mb-1">Items (comma separated)</label>
              <input value={items} onChange={e => setItems(e.target.value)} type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500" placeholder="e.g. Roti, Dal, Rice" />
            </div>
            {message && <p className="text-xs text-green-600">{message}</p>}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-700">Save Menu</button>
          </form>
        </div>

        <div className="p-6 border border-gray-100 rounded-xl">
          <h2 className="font-medium tracking-tight text-gray-900 mb-4">Ratings & Feedback</h2>
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.meal_type} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="capitalize font-medium text-gray-900 text-sm">{r.meal_type}</span>
                <span className="text-sm font-medium text-gray-900">★ {r.average_rating ? Number(r.average_rating).toFixed(1) : 'N/A'}</span>
              </div>
            ))}
            {reviews.length === 0 && <p className="text-sm text-gray-500">No reviews yet.</p>}
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">Current Menu Preview</h2>
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr className="text-gray-400">
                <th className="px-6 py-3 font-medium">Day</th>
                {meals.map(m => <th key={m} className="px-6 py-3 font-medium capitalize">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => (
                <tr key={d} className="border-t border-gray-100">
                  <td className="px-6 py-4 text-gray-900 capitalize font-medium">{d}</td>
                  {meals.map(m => {
                    const md = menu.find(x => x.day_of_week === d && x.meal_type === m)
                    return <td key={m} className="px-6 py-4 text-gray-600">{md?.items?.join(', ') || '-'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
