'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { LostAndFound } from '@/types';
import { container } from '@/lib/ui';
import { Target, MapPin, Calendar } from 'lucide-react';

const ORANGE = '#fb923c';
const ORANGE_SOFT = 'rgba(251,146,60,0.12)';
const ORANGE_BORDER = 'rgba(251,146,60,0.5)';

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '13px',
  color: 'rgba(255,255,255,0.85)',
  outline: 'none',
  colorScheme: 'dark',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '6px',
};

const onInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = ORANGE_BORDER;
};
const onInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
};

export default function StudentLostFound() {
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('lost');
  const [location, setLocation] = useState('');
  const [items, setItems] = useState<LostAndFound[]>([]);
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [matchData, setMatchData] = useState<{
    found: boolean;
    item?: LostAndFound;
    confidence?: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchItems = async (currentPage = 1) => {
    try {
      const res = await apiGet(`/api/v1/lost-found?page=${currentPage}&limit=20`);
      if (res.success) {
        if (currentPage === 1) {
          setItems(res.data || []);
        } else {
          setItems((prev) => [...prev, ...(res.data || [])]);
        }
        setHasNext(res.pagination?.hasNext || false);
      }
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchItems(1);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !description || (status === 'found' && !location))
      {return setError('All fields required');}

    // Optimistic UI update
    setItems((prev) => [
      {
        id: crypto.randomUUID(),
        item_name: itemName,
        description,
        status: status as 'lost' | 'found' | 'claimed',
        location_found: location,
        reported_by: 'pending',
        date_reported: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      } as LostAndFound,
      ...(prev || []),
    ]);

    try {
      const res = await apiPost('/api/v1/lost-found', {
        item_name: itemName,
        description,
        status,
        location_found: location,
      });
      if (res.success) {
        setItemName('');
        setDescription('');
        setStatus('lost');
        setLocation('');
        setError('');
        setSuccess('Report submitted successfully');

        if (res.match && res.match.found) {
          setMatchData(res.match);
        } else {
          setMatchData(null);
        }

        setTimeout(() => setSuccess(''), 3000);
        fetchItems(1);
      } else {
        setError(res.error || 'Failed to submit report');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to submit report');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'All') {return true;}
    return item.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <PageShell spotlight="rgba(251,146,60,0.12)">
      <PageHeader title="Lost & Found" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* ── REPORT ITEM ── */}
        <div style={{ ...panelStyle, padding: '24px', marginBottom: '32px' }} className="glass-card">
          <h2 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: '16px' }}>
            Report Item
          </h2>
          <form onSubmit={handleSubmit} style={{ maxWidth: '32rem' }}>
            {/* Lost / Found toggle */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
              <button
                type="button"
                onClick={() => setStatus('lost')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: status === 'lost' ? `0.5px solid ${ORANGE_BORDER}` : '0.5px solid rgba(255,255,255,0.1)',
                  background: status === 'lost' ? ORANGE_SOFT : 'rgba(255,255,255,0.03)',
                  color: status === 'lost' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                }}
              >
                I Lost Something
              </button>
              <button
                type="button"
                onClick={() => setStatus('found')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: status === 'found' ? `0.5px solid ${ORANGE_BORDER}` : '0.5px solid rgba(255,255,255,0.1)',
                  background: status === 'found' ? ORANGE_SOFT : 'rgba(255,255,255,0.03)',
                  color: status === 'found' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                }}
              >
                I Found Something
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Item Name</label>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
                type="text"
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                style={{ ...inputStyle, resize: 'vertical' }}
                rows={3}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              ></textarea>
            </div>
            {status === 'found' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Location Found</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                  type="text"
                  style={inputStyle}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>
            )}
            {error && <p className="text-red-500" style={{ fontSize: '12px', marginBottom: '12px' }}>{error}</p>}
            {success && <p style={{ fontSize: '12px', color: '#4ade80', marginBottom: '12px' }}>{success}</p>}
            <button
              type="submit"
              style={{
                background: ORANGE,
                color: '#1a0f04',
                borderRadius: '10px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'filter 0.2s',
              }}
              className="btn-primary"
            >
              Submit Report
            </button>
          </form>

          {matchData && matchData.found && (
            <div
              style={{
                position: 'relative',
                marginTop: '20px',
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(251,191,36,0.08)',
                border: '0.5px solid rgba(251,191,36,0.25)',
              }}
            >
              <button
                type="button"
                onClick={() => setMatchData(null)}
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  background: 'transparent',
                  border: 'none',
                  color: '#fbbf24',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                ✕
              </button>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fbbf24', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Target size={14} /> Potential Match Found! ({matchData.confidence}% confidence)
              </h3>
              <p style={{ fontSize: '13px', color: 'rgba(251,191,36,0.85)' }}>
                Someone reported {matchData.item?.status === 'found' ? 'finding' : 'losing'}:{' '}
                <strong>{matchData.item?.item_name}</strong>
              </p>
              <p style={{ fontSize: '13px', color: 'rgba(251,191,36,0.85)', marginTop: '8px' }}>
                Check your notices for details.
              </p>
            </div>
          )}
        </div>

        {/* ── DIRECTORY ── */}
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: '16px' }}>
            All Items Directory
          </h2>

          {/* Filter tabs */}
          <div
            style={{
              display: 'flex',
              gap: '20px',
              borderBottom: '0.5px solid rgba(255,255,255,0.07)',
              marginBottom: '24px',
              paddingBottom: '8px',
              overflowX: 'auto',
            }}
            className="no-scrollbar"
          >
            {['All', 'Lost', 'Found', 'Claimed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '4px 2px',
                  fontSize: '13px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                  color: filter === f ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                  borderBottom: filter === f ? `2px solid ${ORANGE_BORDER}` : '2px solid transparent',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filteredItems.length === 0 ? (
              <div style={{ ...panelStyle, gridColumn: '1 / -1', padding: '8px' }}>
                <EmptyState message="No items found" />
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.id} style={{ ...panelStyle, padding: '20px' }} className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{item.item_name}</h3>
                    <Badge
                      variant={
                        item.status === 'lost'
                          ? 'danger'
                          : item.status === 'found'
                            ? 'success'
                            : 'default'
                      }
                    >
                      {item.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '14px' }}>{item.description}</p>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {item.location_found && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {item.location_found}</span>}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {hasNext && (
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  fetchItems(nextPage);
                }}
                style={{
                  padding: '9px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                className="btn-ghost"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
