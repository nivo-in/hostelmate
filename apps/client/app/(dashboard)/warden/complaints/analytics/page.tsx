'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ui, panel, panelElevated, buttonPrimary, container } from '@/lib/ui';
import { Bot } from 'lucide-react';

export default function ComplaintsAnalytics() {
  const [stats, setStats] = useState<{
    by_category: Record<string, number>;
    by_status: Record<string, number>;
    by_urgency: Record<string, number>;
    average_resolution_time_hours: number;
  } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{
    patterns: Array<{
      issue: string;
      frequency: string;
      recommendation: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    summary: string;
  } | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const { apiGet } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiGet('/api/v1/complaints/stats');
        if (res.success) {setStats(res.data);}
      } catch {}
    };
    fetchStats();
  }, []);

  const generateAiAnalysis = async () => {
    setLoadingAi(true);
    try {
      const res = await apiGet('/api/v1/complaints/analytics');
      if (res.success) {setAiAnalysis(res.data);}
    } catch {
    } finally {
      setLoadingAi(false);
    }
  };

  const categories = ['electrical', 'plumbing', 'furniture', 'cleaning', 'other'];
  const colors: Record<string, string> = {
    electrical: ui.amber,
    plumbing: ui.blue,
    furniture: ui.green,
    cleaning: '#2dd4bf',
    other: 'rgba(255,255,255,0.4)',
  };

  const totalComplaints = stats
    ? Object.values(stats.by_category).reduce((a: number, b: number) => a + b, 0)
    : 0;

  const statTiles = [
    { label: 'Total', value: totalComplaints, color: ui.text },
    { label: 'Open', value: stats?.by_status.open || 0, color: ui.red },
    { label: 'In Progress', value: stats?.by_status.in_progress || 0, color: ui.amber },
    { label: 'Resolved', value: stats?.by_status.resolved || 0, color: ui.green },
  ];

  const priorityVariant = (priority: 'high' | 'medium' | 'low') =>
    priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'success';

  return (
    <PageShell>
      <PageHeader title="Complaint Analytics" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* SECTION 1 — Stats Row */}
        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            {statTiles.map((t) => (
              <div key={t.label} style={{ ...panelElevated, padding: '18px 20px', textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 500,
                    color: t.color,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {t.value}
                </div>
                <div style={{ fontSize: '11px', color: ui.textMuted, marginTop: '6px' }}>{t.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* SECTION 2 — Category Breakdown */}
        {stats && (
          <div style={{ ...panel, padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 500, color: ui.text, margin: '0 0 20px' }}>
              Category Breakdown
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {categories.map((cat) => {
                const count = stats.by_category[cat] || 0;
                const percentage = totalComplaints ? Math.round((count / totalComplaints) * 100) : 0;
                return (
                  <div key={cat}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        marginBottom: '6px',
                      }}
                    >
                      <span style={{ textTransform: 'capitalize', color: ui.textSoft }}>{cat}</span>
                      <span style={{ color: ui.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.06)',
                        height: '6px',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          borderRadius: '9999px',
                          background: colors[cat],
                          width: `${percentage}%`,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 3 — AI Maintenance Insights */}
        <div style={{ ...panel, padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: aiAnalysis ? '20px' : 0,
            }}
          >
            <h2 style={{ fontSize: '15px', fontWeight: 500, color: ui.text, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={18} /> AI Maintenance Insights
            </h2>
            {!aiAnalysis && (
              <button
                onClick={generateAiAnalysis}
                disabled={loadingAi}
                className="btn-primary"
                style={{ ...buttonPrimary, opacity: loadingAi ? 0.5 : 1, cursor: loadingAi ? 'default' : 'pointer' }}
              >
                {loadingAi ? 'Analyzing complaint patterns...' : 'Generate AI Analysis'}
              </button>
            )}
          </div>

          {aiAnalysis && (
            <div>
              <p style={{ fontSize: '13px', color: ui.textSoft, margin: '0 0 20px', lineHeight: 1.6 }}>
                {aiAnalysis.summary}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {aiAnalysis.patterns.map(
                  (
                    pattern: {
                      issue: string;
                      frequency: string;
                      recommendation: string;
                      priority: 'high' | 'medium' | 'low';
                    },
                    idx: number
                  ) => (
                    <div key={idx} style={{ ...panelElevated, padding: '18px 20px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '12px',
                          marginBottom: '8px',
                        }}
                      >
                        <h3 style={{ fontSize: '13px', fontWeight: 500, color: ui.text, margin: 0 }}>
                          {pattern.issue}
                        </h3>
                        <Badge variant={priorityVariant(pattern.priority)}>
                          {pattern.priority} priority
                        </Badge>
                      </div>
                      <div style={{ fontSize: '11px', color: ui.textMuted, marginBottom: '12px' }}>
                        Frequency: {pattern.frequency}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: ui.textSoft,
                          background: 'rgba(255,255,255,0.03)',
                          padding: '12px 14px',
                          borderRadius: ui.radiusXs,
                          border: ui.border,
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ fontWeight: 500, color: ui.text }}>Recommendation:</span>{' '}
                        {pattern.recommendation}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
