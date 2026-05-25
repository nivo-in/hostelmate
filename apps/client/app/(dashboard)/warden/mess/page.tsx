/**
 * @file apps/client/app/(dashboard)/warden/mess/page.tsx
 * Warden portal mess administrative page rendering statistics and actions.
 */

'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { AiAnalysisCard } from '@/components/ui/AiAnalysisCard';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { MessMenu, MessReview } from '@/types';
import { ui, panel, panelElevated, input, buttonPrimary, container, label, sectionTitle } from '@/lib/ui';
import { Star } from 'lucide-react';

export default function WardenMess() {
  const [day, setDay] = useState('monday');
  const [mealType, setMealType] = useState('breakfast');
  const [items, setItems] = useState('');
  const [menu, setMenu] = useState<MessMenu[]>([]);
  const [reviews, setReviews] = useState<MessReview[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { apiGet, apiPut } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const meals = ['breakfast', 'lunch', 'snacks', 'dinner'];

  const fetchMenu = async () => {
    try {
      const res = await apiGet('/api/v1/mess/menu');
      if (res.success) {setMenu(res.data || []);}
    } catch {
      // Silently fail
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await apiGet('/api/v1/mess/reviews');
      if (res.success) {setReviews(res.data?.reviews || []);}
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchReviews();
  }, []);

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.trim()) {return setError('Items are required');}

    const itemsList = items
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean);

    // Optimistic UI update
    setMenu((prev) => {
      const current = prev || [];
      const existing = current.filter((m) => !(m.day_of_week === day && m.meal_type === mealType));
      return [
        ...existing,
        {
          id: crypto.randomUUID(),
          day_of_week: day as MessMenu['day_of_week'],
          meal_type: mealType as MessMenu['meal_type'],
          items: itemsList,
          created_at: new Date().toISOString(),
        },
      ] as MessMenu[];
    });

    try {
      const res = await apiPut('/api/v1/mess/menu', {
        day_of_week: day,
        meal_type: mealType,
        items: itemsList,
      });
      if (res.success) {
        setItems('');
        setMessage('Menu updated successfully');
        setError('');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError(res.error || 'Failed to update menu');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to update menu');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getAverageRating = (meal: string) => {
    const mealReviews = reviews.filter((r) => r.meal_type === meal);
    if (mealReviews.length === 0) {return 0;}
    const sum = mealReviews.reduce((acc, curr) => acc + Number(curr.rating), 0);
    return (sum / mealReviews.length).toFixed(1);
  };

  return (
    <PageShell>
      <PageHeader title="Mess Management" showBack onSignOut={handleSignOut} />

      <div style={container}>
        <div style={{ marginBottom: 24 }}>
          <AiAnalysisCard type="mess" themeColor="#7c5cfc" themeRgb="124,92,252" />
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}
          className="mess-grid"
        >
          {/* Update Menu */}
          <div style={{ ...panel, padding: '22px' }} className="glass-card">
            <h2 style={{ ...sectionTitle, fontSize: '13px', marginBottom: '16px' }}>Update Menu</h2>
            <form onSubmit={handleSaveMenu} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={label}>Day</label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="hm-input"
                  style={{ ...input, colorScheme: 'dark', textTransform: 'capitalize' }}
                >
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Meal</label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="hm-input"
                  style={{ ...input, colorScheme: 'dark', textTransform: 'capitalize' }}
                >
                  {meals.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Items (comma separated)</label>
                <input
                  value={items}
                  onChange={(e) => setItems(e.target.value)}
                  type="text"
                  className="hm-input"
                  style={input}
                  placeholder="e.g. Roti, Dal, Rice"
                />
              </div>
              {message && <p style={{ fontSize: '12px', color: ui.green, margin: 0 }}>{message}</p>}
              {error && <p style={{ fontSize: '12px', color: ui.red, margin: 0 }}>{error}</p>}
              <button type="submit" className="btn-primary" style={{ ...buttonPrimary, alignSelf: 'flex-start' }}>
                Save Menu
              </button>
            </form>
          </div>

          {/* Average Ratings */}
          <div style={{ ...panel, padding: '22px' }} className="glass-card">
            <h2 style={{ ...sectionTitle, fontSize: '13px', marginBottom: '16px' }}>Average Ratings</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {meals.map((m) => (
                <div
                  key={m}
                  style={{
                    ...panelElevated,
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 500, color: ui.text, textTransform: 'capitalize' }}>
                    {m}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: ui.amber, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {getAverageRating(m)} <Star size={12} className="fill-current" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Current Week Menu */}
        <h2 style={{ ...sectionTitle, marginBottom: '14px' }}>Current Week Menu</h2>
        <div style={{ ...panel, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: ui.border }}>
                  {['Day', ...meals].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 18px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: ui.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d} className="row-hover" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 18px', color: ui.text, fontWeight: 500, textTransform: 'capitalize' }}>
                      {d}
                    </td>
                    {meals.map((m) => {
                      const md = menu.find((x) => x.day_of_week === d && x.meal_type === m);
                      return (
                        <td key={m} style={{ padding: '12px 18px', color: ui.textSoft, minWidth: '120px' }}>
                          {md?.items?.join(', ') || '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .mess-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PageShell>
  );
}
