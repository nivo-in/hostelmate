'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { Reveal } from '@/components/ui/Reveal';
import { useApi } from '@/hooks/useApi';
import { Notice } from '@/types';
import { Megaphone, Bell, Calendar } from 'lucide-react';

export default function ParentNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const { apiGet } = useApi();

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const res = await apiGet('/api/v1/notices');
        if (res.success) {
          setNotices(res.data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchNotices();
  }, [apiGet]);

  return (
    <PageShell title="Notices & Announcements" subtitle="Official hostel notifications and announcements">
      <Reveal>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '40px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
              Loading announcements...
            </div>
          ) : notices.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'rgba(255,255,255,0.3)' }}>
                <Bell size={20} />
              </div>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500 }}>No notices posted</p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>Check back later for hostel updates and announcements.</p>
            </div>
          ) : (
            notices.map((notice, i) => (
              <Reveal key={notice.id} delay={i * 40}>
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px', padding: '20px 24px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(251,146,60,0.1)', border: '0.5px solid rgba(251,146,60,0.25)', color: '#fb923c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Megaphone size={16} />
                      </div>
                      <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff', margin: 0 }}>
                        {notice.title}
                      </h3>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                      <Calendar size={12} />
                      {new Date(notice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '12px 0 0 0', whiteSpace: 'pre-wrap' }}>
                    {notice.content}
                  </p>
                </div>
              </Reveal>
            ))
          )}
        </div>
      </Reveal>
    </PageShell>
  );
}
