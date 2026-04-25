'use client';

import { useEffect, useState, useMemo } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { container } from '@/lib/ui';
import { Notice } from '@/types';
import { Search } from 'lucide-react';

export default function StudentNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { apiGet } = useApi();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const res = await apiGet('/api/v1/notices');
        if (res.success) {setNotices(res.data);}
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchNotices();
  }, []);

  const filteredNotices = useMemo(() => {
    if (!searchQuery.trim()) {return notices;}
    const q = searchQuery.toLowerCase();
    return notices.filter(
      (n) => n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
    );
  }, [notices, searchQuery]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <PageShell spotlight="rgba(251,146,60,0.12)">
      <PageHeader title="Notices" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search notices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search notices"
            className="hm-input hm-input-orange"
            style={{
              width: '100%', padding: '8px 12px 8px 34px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)',
              color: '#ffffff', fontSize: '13px', outline: 'none',
              transition: 'border-color 0.15s ease', boxSizing: 'border-box'
            }}
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ ...panelStyle, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div className="skeleton" style={{ height: '14px', width: '35%' }} />
                  <div className="skeleton" style={{ height: '20px', width: '50px', borderRadius: '6px' }} />
                </div>
                <div className="skeleton" style={{ height: '12px', width: '20%', marginBottom: '10px' }} />
                <div className="skeleton" style={{ height: '13px', width: '90%', marginBottom: '6px' }} />
                <div className="skeleton" style={{ height: '13px', width: '70%' }} />
              </div>
            ))}
          </div>
        ) : filteredNotices.length === 0 ? (
          <div
            className="glass-card"
            style={{
              ...panelStyle,
              padding: '40px',
              textAlign: 'center',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            {searchQuery ? 'No notices match your search.' : 'No notices yet'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredNotices.map((notice) => (
              <div
                key={notice.id}
                className="glass-card"
                style={{ ...panelStyle, padding: '18px 20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
                    {notice.title}
                  </h3>
                  <span style={noticePill}>Notice</span>
                </div>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>
                  {new Date(notice.created_at).toLocaleString()}
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.6)',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                  }}
                >
                  {notice.content}
                </p>
              </div>
            ))}
          </div>
        )}
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

const noticePill: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.4px',
  color: '#fb923c',
  background: 'rgba(251,146,60,0.1)',
  border: '0.5px solid rgba(251,146,60,0.25)',
  borderRadius: '6px',
  padding: '3px 8px',
};
