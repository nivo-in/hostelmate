'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { AiAnalysisCard } from '@/components/ui/AiAnalysisCard';
import { useRouter } from 'next/navigation';
import { container } from '@/lib/ui';
import { Complaint } from '@/types';
import { Bot, AlertTriangle } from 'lucide-react';

const ORANGE = '#fb923c';

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
  transition: 'border-color 0.2s',
};

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  open: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' },
  pending: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' },
  in_progress: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
  resolved: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)' },
  closed: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)' },
  default: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' },
};

const URGENT_STYLE = { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' };

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.default;
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        border: `0.5px solid ${s.border}`,
        borderRadius: '6px',
        padding: '3px 8px',
      }}
    >
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
}

export default function StudentComplaints() {
  const [description, setDescription] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [aiInfo, setAiInfo] = useState<{
    classified: boolean;
    category_changed: boolean;
    urgency_changed: boolean;
    summary: string;
    confidence: number;
    finalCategory: string;
    finalUrgency: boolean;
  } | null>(null);

  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchComplaints = async () => {
    try {
      const res = await apiGet('/api/v1/complaints/my');
      if (res.success) {setComplaints(res.data || []);}
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {return setError('Description required');}

    try {
      const res = await apiPost('/api/v1/complaints', {
        category: 'other',
        description,
        is_urgent: urgent,
      });
      if (res.success) {
        setDescription('');
        setUrgent(false);
        setError('');
        setSuccess('Complaint submitted successfully');

        if (res.ai?.classified) {
          setAiInfo({
            ...res.ai,
            finalCategory: res.data.category,
            finalUrgency: res.data.is_urgent,
          });
          setTimeout(() => {
            setSuccess('');
            setAiInfo(null);
          }, 5000);
        } else {
          setTimeout(() => setSuccess(''), 3000);
        }

        fetchComplaints();
      } else {
        setError(res.error || 'Failed to submit complaint');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to submit complaint');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <PageShell spotlight="rgba(251,146,60,0.12)">
      <PageHeader title="Complaints" showBack onSignOut={handleSignOut} />

      <div style={container}>
        <div style={{ marginBottom: 24 }}>
          <AiAnalysisCard type="complaints" themeColor="#fb923c" themeRgb="251,146,60" />
        </div>
        <div style={{ ...panelStyle, padding: '24px', marginBottom: '28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '480px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Describe your issue in detail — AI will auto-categorize"
                rows={3}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(251,146,60,0.5)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
              ></textarea>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setUrgent(!urgent)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors`}
                style={{ background: urgent ? ORANGE : 'rgba(255,255,255,0.15)' }}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${urgent ? 'translate-x-5' : 'translate-x-1'}`}
                />
              </button>
              <label
                style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}
                onClick={() => setUrgent(!urgent)}
              >
                Mark as urgent (AI may override)
              </label>
            </div>

            {error && <p className="text-red-500" style={{ fontSize: '12px' }}>{error}</p>}
            {success && <p style={{ fontSize: '12px', color: '#4ade80' }}>{success}</p>}

            {aiInfo && (
              <div
                style={{
                  background: 'rgba(96,165,250,0.08)',
                  border: '0.5px solid rgba(96,165,250,0.25)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}><Bot size={14} /> AI Analysis</div>
                {aiInfo.category_changed && (
                  <div style={{ fontSize: '12px', color: 'rgba(96,165,250,0.85)', marginTop: '4px' }}>
                    Category updated to: {aiInfo.finalCategory}
                  </div>
                )}
                {aiInfo.urgency_changed && aiInfo.finalUrgency && (
                  <div style={{ fontSize: '12px', color: ORANGE, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={14} /> Marked as urgent based on description
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                  AI Confidence: {Math.round((aiInfo.confidence || 0) * 100)}%
                </div>
              </div>
            )}

            <button
              type="submit"
              style={{
                alignSelf: 'flex-start',
                background: ORANGE,
                color: '#1a0f04',
                fontWeight: 600,
                fontSize: '13px',
                borderRadius: '10px',
                padding: '9px 16px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Submit Complaint
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {complaints.length === 0 ? (
            <div style={{ ...panelStyle, padding: '32px' }}>
              <EmptyState message="No complaints raised yet" />
            </div>
          ) : (
            complaints.map((c) => (
              <div key={c.id} className="glass-card" style={{ ...panelStyle, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ textTransform: 'capitalize', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                      {c.category}
                    </span>
                    {c.is_urgent && (
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: URGENT_STYLE.color,
                          background: URGENT_STYLE.bg,
                          border: `0.5px solid ${URGENT_STYLE.border}`,
                          borderRadius: '6px',
                          padding: '3px 8px',
                        }}
                      >
                        URGENT
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>{c.description}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <StatusPill status={c.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
