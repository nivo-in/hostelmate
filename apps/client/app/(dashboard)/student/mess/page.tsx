'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { AiAnalysisCard } from '@/components/ui/AiAnalysisCard';
import { useRouter } from 'next/navigation';
import { container } from '@/lib/ui';
import { MessMenu } from '@/types';
import { Star } from 'lucide-react';

const ORANGE = '#fb923c';
const ORANGE_BORDER = 'rgba(251,146,60,0.4)';

export default function StudentMess() {
  const [activeDay, setActiveDay] = useState('monday');
  const [menu, setMenu] = useState<MessMenu[]>([]);
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string }>>({});
  const [success, setSuccess] = useState('');
  const [today, setToday] = useState('');

  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const meals = ['breakfast', 'lunch', 'snacks', 'dinner'];

  useEffect(() => {
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    setActiveDay(todayStr);
    setToday(new Date().toISOString().split('T')[0]);

    const fetchMenu = async () => {
      try {
        const res = await apiGet('/api/v1/mess/menu');
        if (res.success) {setMenu(res.data || []);}
      } catch {}
    };
    fetchMenu();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleRatingChange = (meal: string, rating: number) => {
    setRatings((prev) => ({
      ...prev,
      [meal]: { ...prev[meal], rating, comment: prev[meal]?.comment || '' },
    }));
  };

  const handleCommentChange = (meal: string, comment: string) => {
    setRatings((prev) => ({
      ...prev,
      [meal]: { ...prev[meal], rating: prev[meal]?.rating || 0, comment },
    }));
  };

  const handleSubmitRatings = async () => {
    const entries = Object.entries(ratings).filter(([_, data]) => data.rating > 0);
    if (entries.length === 0) {return;}

    try {
      await Promise.all(
        entries.map(([meal_type, data]) =>
          apiPost('/api/v1/mess/review', {
            meal_type,
            rating: data.rating,
            comments: data.comment,
            date: new Date().toISOString().split('T')[0],
          })
        )
      );
      setSuccess('Ratings submitted successfully!');
      setRatings({});
      setTimeout(() => setSuccess(''), 3000);
    } catch {}
  };

  const activeMenu = menu.filter((m) => m.day_of_week === activeDay);

  return (
    <PageShell spotlight="rgba(251,146,60,0.12)">
      <PageHeader title="Mess" showBack onSignOut={handleSignOut} />

      <div style={container}>
        <div style={{ marginBottom: 24 }}>
          <AiAnalysisCard type="mess" themeColor="#fb923c" themeRgb="251,146,60" />
        </div>
        {/* ── DAY TABS ── */}
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              display: 'flex',
              overflowX: 'auto',
              gap: '8px',
              borderBottom: '0.5px solid rgba(255,255,255,0.07)',
              marginBottom: '20px',
              paddingBottom: '10px',
            }}
          >
            {days.map((d) => {
              const isActive = activeDay === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setActiveDay(d)}
                  style={{
                    flexShrink: 0,
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    padding: '8px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: isActive ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.03)',
                    border: isActive ? `0.5px solid ${ORANGE_BORDER}` : '0.5px solid rgba(255,255,255,0.07)',
                    color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
                  }}
                >
                  {d.substring(0, 3)}
                </button>
              );
            })}
          </div>

          {/* ── MEAL CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {meals.map((meal) => {
              const item = activeMenu.find((m) => m.meal_type === meal);
              return (
                <div key={meal} className="glass-card" style={{ ...panelStyle, padding: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', textTransform: 'capitalize', marginBottom: '8px' }}>
                    {meal}
                  </h3>
                  <p style={{ fontSize: '13px', color: item?.items?.length ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)' }}>
                    {item?.items?.length ? item.items.join(', ') : 'Menu not set'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RATE TODAY'S MEALS ── */}
        <div style={{ ...panelStyle, padding: '24px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 500, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.9)', marginBottom: '4px' }}>
            Rate Today&apos;s Meals
          </h2>
          {today && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px' }}>{today}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {meals.map((meal, idx) => (
              <div
                key={meal}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '16px',
                  paddingTop: idx === 0 ? 0 : '16px',
                  paddingBottom: idx === meals.length - 1 ? 0 : '16px',
                  borderBottom: idx === meals.length - 1 ? 'none' : '0.5px solid rgba(255,255,255,0.05)',
                }}
              >
                <span style={{ width: '96px', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', textTransform: 'capitalize' }}>
                  {meal}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingChange(meal, star)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        outline: 'none',
                        padding: 0,
                        transition: 'color 0.15s',
                        color: (ratings[meal]?.rating ?? 0) >= star ? ORANGE : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      <Star size={20} fill={(ratings[meal]?.rating ?? 0) >= star ? 'currentColor' : 'transparent'} strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Optional comment..."
                  value={ratings[meal]?.comment || ''}
                  onChange={(e) => handleCommentChange(meal, e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.85)',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(251,146,60,0.5)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              type="button"
              onClick={handleSubmitRatings}
              style={{
                background: ORANGE,
                color: '#1a0f04',
                fontWeight: 600,
                fontSize: '13px',
                borderRadius: '10px',
                padding: '9px 16px',
                border: 'none',
                cursor: 'pointer',
                transition: 'filter 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            >
              Submit All Ratings
            </button>
            {success && <span style={{ fontSize: '13px', color: '#4ade80' }}>{success}</span>}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
};
