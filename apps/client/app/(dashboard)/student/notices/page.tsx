'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { container } from '@/lib/ui';
import { Notice } from '@/types';

export default function StudentNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
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
      }
    };
    fetchNotices();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <PageShell spotlight="rgba(251,146,60,0.12)">
      <PageHeader title="Notices" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {notices.length === 0 ? (
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
            No notices yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notices.map((notice) => (
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
  color: '#60a5fa',
  background: 'rgba(96,165,250,0.1)',
  border: '0.5px solid rgba(96,165,250,0.25)',
  borderRadius: '6px',
  padding: '3px 8px',
};
