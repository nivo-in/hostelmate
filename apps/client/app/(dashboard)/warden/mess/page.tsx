'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';

export default function WardenMess() {
  const [day, setDay] = useState('monday');
  const [mealType, setMealType] = useState('breakfast');
  const [items, setItems] = useState('');
  const [menu, setMenu] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const { apiGet, apiPut } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const meals = ['breakfast', 'lunch', 'snacks', 'dinner'];

  const fetchMenu = async () => {
    try {
      const res = await apiGet('/api/mess/menu');
      if (res.success) setMenu(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await apiGet('/api/mess/reviews');
      if (res.success) setReviews(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchReviews();
  }, []);

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.trim()) return setError('Items are required');
    
    const itemsList = items.split(',').map(i => i.trim()).filter(Boolean);
    
    // Optimistic UI update
    setMenu(prev => {
      const current = prev || [];
      const existing = current.filter(m => !(m.day_of_week === day && m.meal_type === mealType));
      return [...existing, { day_of_week: day, meal_type: mealType, items: itemsList }];
    });

    try {
      const res = await apiPut('/api/mess/menu', { day_of_week: day, meal_type: mealType, items: itemsList });
      if (res.success) {
        setItems('');
        setMessage('Menu updated successfully');
        setError('');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError(res.error || 'Failed to update menu');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update menu');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getAverageRating = (meal: string) => {
    const mealReviews = reviews.filter(r => r.meal_type === meal);
    if (mealReviews.length === 0) return 0;
    const sum = mealReviews.reduce((acc, curr) => acc + Number(curr.rating), 0);
    return (sum / mealReviews.length).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Mess Management" showBack onSignOut={handleSignOut} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
          <h2 className="font-medium tracking-tight text-gray-900 mb-4">Update Menu</h2>
          <form onSubmit={handleSaveMenu} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Day</label>
              <select value={day} onChange={e => setDay(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full bg-white">
                {days.map(d => <option key={d} value={d} className="capitalize">{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Meal</label>
              <select value={mealType} onChange={e => setMealType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full bg-white">
                {meals.map(m => <option key={m} value={m} className="capitalize">{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Items (comma separated)</label>
              <input value={items} onChange={e => setItems(e.target.value)} type="text" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full" placeholder="e.g. Roti, Dal, Rice" />
            </div>
            {message && <p className="text-xs text-green-600">{message}</p>}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors">Save Menu</button>
          </form>
        </div>

        <div className="p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
          <h2 className="font-medium tracking-tight text-gray-900 mb-4">Average Ratings</h2>
          <div className="space-y-4">
            {meals.map(m => (
              <div key={m} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                <span className="capitalize font-medium text-gray-900 text-sm">{m}</span>
                <span className="text-sm font-medium text-gray-900">{getAverageRating(m)} ⭐</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-medium tracking-tight text-gray-900 mb-4">Current Week Menu</h2>
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 font-medium text-xs text-gray-500">Day</th>
                {meals.map(m => <th key={m} className="px-4 py-3 font-medium text-xs text-gray-500 capitalize">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map(d => (
                <tr key={d} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-gray-900 capitalize font-medium bg-gray-50/50">{d}</td>
                  {meals.map(m => {
                    const md = menu.find(x => x.day_of_week === d && x.meal_type === m);
                    return <td key={m} className="px-4 py-3 text-gray-600 min-w-[120px]">{md?.items?.join(', ') || '-'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
