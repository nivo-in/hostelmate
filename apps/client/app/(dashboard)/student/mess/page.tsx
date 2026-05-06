'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { createClient } from '@/lib/supabase/client'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'

export default function StudentMess() {
  const [activeDay, setActiveDay] = useState('monday')
  const [menu, setMenu] = useState<any[]>([])
  
  const { apiGet } = useApi()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    apiGet('/api/mess/menu').then(res => {
      if (res.success) setMenu(res.data)
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const meals = ['breakfast', 'lunch', 'snacks', 'dinner']

  const todayMenu = menu.filter(m => m.day_of_week === activeDay)

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <Header title="Mess" onSignOut={handleSignOut} />
      
      <div className="mb-10">
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">Weekly Menu</h2>
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2">
          {days.map(d => (
            <button key={d} onClick={() => setActiveDay(d)} className={`capitalize px-4 py-2 rounded-lg text-sm whitespace-nowrap ${activeDay === d ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              {d}
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {meals.map(meal => {
            const mealData = todayMenu.find(m => m.meal_type === meal)
            return (
              <div key={meal} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                <h3 className="font-medium text-gray-900 capitalize mb-2">{meal}</h3>
                <p className="text-sm text-gray-600">
                  {mealData?.items?.join(', ') || 'No items listed'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-6 border border-gray-100 rounded-xl">
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">Rate Today's Meals</h2>
        <p className="text-sm text-gray-500 mb-4">Select a meal and provide your rating</p>
        <form onSubmit={(e) => { e.preventDefault(); alert('Rating submitted!') }} className="space-y-4 max-w-md">
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-gray-500">
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="snacks">Snacks</option>
            <option value="dinner">Dinner</option>
          </select>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-gray-500">
            <option value="5">5 Stars - Excellent</option>
            <option value="4">4 Stars - Good</option>
            <option value="3">3 Stars - Average</option>
            <option value="2">2 Stars - Poor</option>
            <option value="1">1 Star - Terrible</option>
          </select>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm min-h-[80px] outline-none focus:border-gray-500" placeholder="Optional comments..."></textarea>
          <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-700">Submit Rating</button>
        </form>
      </div>
    </div>
  )
}
