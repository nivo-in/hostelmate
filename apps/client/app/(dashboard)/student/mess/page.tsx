'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { MessMenu } from '@/types'

export default function StudentMess() {
  const [activeDay, setActiveDay] = useState('');
  const [menu, setMenu] = useState<MessMenu[]>([]);
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string }>>({});
  const [success, setSuccess] = useState('');
  
  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const meals = ['breakfast', 'lunch', 'snacks', 'dinner'];

  useEffect(() => {
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    setActiveDay(todayStr);

    const fetchMenu = async () => {
      try {
        const res = await apiGet('/api/mess/menu');
        if (res.success) setMenu(res.data || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchMenu();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleRatingChange = (meal: string, rating: number) => {
    setRatings(prev => ({
      ...prev,
      [meal]: { ...prev[meal], rating, comment: prev[meal]?.comment || '' }
    }));
  };

  const handleCommentChange = (meal: string, comment: string) => {
    setRatings(prev => ({
      ...prev,
      [meal]: { ...prev[meal], rating: prev[meal]?.rating || 0, comment }
    }));
  };

  const handleSubmitRatings = async () => {
    const promises = Object.entries(ratings)
      .filter(([_, data]) => data.rating > 0)
      .map(([meal_type, data]) => 
        apiPost('/api/mess/reviews', { meal_type, rating: data.rating, comments: data.comment })
      );
      
    if (promises.length === 0) return;
    
    try {
      await Promise.all(promises);
      setSuccess('Ratings submitted successfully!');
      setRatings({});
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const activeMenu = menu.filter(m => m.day_of_week === activeDay);

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Mess" showBack onSignOut={handleSignOut} />
      
      <div className="mb-8">
        <div className="flex overflow-x-auto border-b border-gray-100 mb-6 pb-2 no-scrollbar">
          {days.map(d => (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={`px-4 py-2 text-sm font-medium capitalize whitespace-nowrap transition-colors ${activeDay === d ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {d.substring(0, 3)}
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meals.map(meal => {
            const item = activeMenu.find(m => m.meal_type === meal);
            return (
              <div key={meal} className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors bg-white">
                <h3 className="text-sm font-medium text-gray-900 capitalize mb-2">{meal}</h3>
                <p className="text-sm text-gray-600">
                  {item && item.items && item.items.length > 0 ? item.items.join(', ') : 'Menu not set'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border border-gray-100 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Rate Today's Meals</h2>
        <p className="text-xs text-gray-500 mb-6">{new Date().toLocaleDateString()}</p>
        
        <div className="space-y-6">
          {meals.map(meal => (
            <div key={meal} className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-gray-50 pb-4 last:border-0 last:pb-0">
              <span className="w-24 text-sm font-medium text-gray-900 capitalize">{meal}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button 
                    key={star} 
                    onClick={() => handleRatingChange(meal, star)}
                    className={`text-xl focus:outline-none ${ratings[meal]?.rating >= star ? 'text-yellow-400' : 'text-gray-200 hover:text-gray-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Optional comment..." 
                value={ratings[meal]?.comment || ''}
                onChange={e => handleCommentChange(meal, e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors"
              />
            </div>
          ))}
        </div>
        
        <div className="mt-6 flex items-center gap-4">
          <button 
            onClick={handleSubmitRatings}
            className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Submit All Ratings
          </button>
          {success && <span className="text-sm text-green-600">{success}</span>}
        </div>
      </div>
    </div>
  );
}
