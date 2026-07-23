'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { AiAnalysisCard } from '@/components/ui/AiAnalysisCard';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { LeaveRequest } from '@/types';
import { container } from '@/lib/ui';

const ORANGE = '#fb923c';

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  approved:  { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.25)' },
  rejected:  { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
  pending:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)' },
  on_leave:  { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.25)' },
  default:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)' },
};

export default function StudentLeaves() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const today = new Date().toISOString().split('T')[0];

  const fetchLeaves = async () => {
    try {
      const res = await apiGet('/api/v1/leaves/my');
      if (res.success) {setLeaves(res.data || []);}
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.length < 20) {return setError('Reason must be at least 20 chars');}

    // Optimistic UI update
    setLeaves((prev) => [
      {
        id: crypto.randomUUID(),
        start_date: start,
        end_date: end,
        reason: reason,
        status: 'pending',
        created_at: new Date().toISOString(),
      } as LeaveRequest,
      ...(prev || []),
    ]);

    try {
      const res = await apiPost('/api/v1/leaves', { start_date: start, end_date: end, reason });
      if (res.success) {
        setStart('');
        setEnd('');
        setReason('');
        setError('');
        setSuccess('Leave request submitted successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(res.error || 'Failed to submit leave');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to submit leave');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const onInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'rgba(251,146,60,0.5)';
  };
  const onInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
  };

  return (
    <PageShell spotlight="rgba(251,146,60,0.12)">
      <PageHeader title="Leave Requests" showBack onSignOut={handleSignOut} />

      <div style={container}>
        <div style={{ marginBottom: 24 }}>
          <AiAnalysisCard type="leaves" themeColor="#fb923c" themeRgb="251,146,60" />
        </div>
        {/* ── REQUEST FORM ── */}
        <div style={{ ...panelStyle, padding: '24px', marginBottom: '28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '480px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Start Date</label>
                <input
                  type="date"
                  min={today}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>End Date</label>
                <input
                  type="date"
                  min={start || today}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={20}
                style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
                rows={3}
                placeholder="Describe your reason (min 20 characters)"
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              ></textarea>
            </div>
            {error && (
              <p className="text-red-500" style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>{error}</p>
            )}
            {success && (
              <p style={{ fontSize: '12px', color: '#4ade80', margin: 0 }}>{success}</p>
            )}
            <button
              type="submit"
              style={{
                alignSelf: 'flex-start',
                background: ORANGE,
                color: '#1a0f04',
                fontWeight: 600,
                border: 'none',
                borderRadius: '10px',
                padding: '9px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'filter 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            >
              Apply Leave
            </button>
          </form>
        </div>

        {/* ── HISTORY TABLE ── */}
        <div style={{ ...panelStyle, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                <th style={thStyle}>Applied On</th>
                <th style={thStyle}>Start Date</th>
                <th style={thStyle}>End Date</th>
                <th style={thStyle}>Reason</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
                    No leave requests yet
                  </td>
                </tr>
              ) : (
                leaves.map((l) => {
                  const s = STATUS_STYLES[l.status] || STATUS_STYLES.default;
                  return (
                    <tr key={l.id} className="row-hover" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.5)' }}>
                        {new Date(l.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.8)' }}>{l.start_date}</td>
                      <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.8)' }}>{l.end_date}</td>
                      <td
                        style={{ ...tdStyle, color: 'rgba(255,255,255,0.8)', maxWidth: '200px' }}
                        title={l.reason}
                      >
                        {l.reason.substring(0, 50)}
                        {l.reason.length > 50 ? '...' : ''}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.4px', color: s.color, background: s.bg, border: `0.5px solid ${s.border}`, borderRadius: '6px', padding: '3px 8px' }}>
                          {l.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '6px',
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

const thStyle: React.CSSProperties = {
  padding: '12px 20px',
  fontSize: '11px',
  fontWeight: 500,
  color: 'rgba(255,255,255,0.4)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 20px',
};
