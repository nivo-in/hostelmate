'use client';
import { Wrench, Bot, Lightbulb } from 'lucide-react';

import { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { AiAnalysisCard } from '@/components/ui/AiAnalysisCard';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { ComplaintWithStudent } from '@/types';
import { ui, panel, buttonPrimary, buttonGhost, container } from '@/lib/ui';
import { Search } from 'lucide-react';

export default function WardenComplaints() {
  const [activeTab, setActiveTab] = useState('All');
  const [complaints, setComplaints] = useState<ComplaintWithStudent[]>([]);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { apiGet, apiPatch } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchComplaints = async (currentPage = 1) => {
    try {
      const res = await apiGet(`/api/v1/complaints/all?page=${currentPage}&limit=20`);
      if (res.success) {
        if (currentPage === 1) {
          setComplaints(res.data || []);
        } else {
          setComplaints((prev) => [...prev, ...(res.data || [])]);
        }
        setHasNext(res.pagination?.hasNext || false);
      }
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchComplaints(1);
  }, []);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const res = await apiPatch(`/api/v1/complaints/${id}/status`, { status });
      if (res.success) {
        setMessage('Status updated successfully');
        fetchComplaints();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch {
      // Silently fail
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusVariant = (status: string) => {
    if (status === 'resolved') {return 'success';}
    if (status === 'open') {return 'danger';}
    return 'warning';
  };

  const filteredComplaints = useMemo(() => {
    let result = complaints.filter((c) => {
      if (activeTab === 'All') {return true;}
      if (activeTab === 'In Progress') {return c.status === 'in_progress';}
      return c.status.toLowerCase() === activeTab.toLowerCase();
    });
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.profiles?.full_name?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.roll_number?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [complaints, activeTab, searchQuery]);

  return (
    <PageShell>
      <PageHeader title="Complaints" showBack onSignOut={handleSignOut} />

      <div style={container}>
        <div style={{ marginBottom: 24 }}>
          <AiAnalysisCard type="complaints" themeColor="#7c5cfc" themeRgb="124,92,252" />
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by student name, roll number, or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search complaints"
            style={{
              width: '100%', padding: '8px 12px 8px 34px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)',
              color: '#ffffff', fontSize: '13px', outline: 'none',
              transition: 'border-color 0.15s ease', boxSizing: 'border-box'
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: ui.text, margin: 0 }}>
            All Complaints
          </h2>
          <button
            onClick={() => router.push('/warden/complaints/analytics')}
            className="btn-ghost"
            style={buttonGhost}
          >
            View Analytics →
          </button>
        </div>

        {message && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              background: 'rgba(74,222,128,0.1)',
              border: '0.5px solid rgba(74,222,128,0.25)',
              borderRadius: ui.radiusXs,
              color: ui.green,
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {message}
          </div>
        )}

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '24px',
            borderBottom: ui.border,
            paddingBottom: '2px',
            overflowX: 'auto',
          }}
        >
          {['All', 'Open', 'In Progress', 'Resolved'].map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  background: active ? 'rgba(124,92,252,0.12)' : 'transparent',
                  border: active ? '0.5px solid rgba(124,92,252,0.3)' : '0.5px solid transparent',
                  borderRadius: ui.radiusXs,
                  color: active ? ui.text : ui.textMuted,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!active) {e.currentTarget.style.color = ui.textSoft;}
                }}
                onMouseLeave={(e) => {
                  if (!active) {e.currentTarget.style.color = ui.textMuted;}
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredComplaints.length === 0 ? (
            <div style={panel}>
              <EmptyState
                message={`No ${activeTab !== 'All' ? activeTab.toLowerCase() : ''} complaints found`}
                icon={<Wrench strokeWidth={1.5} />}
              />
            </div>
          ) : (
            filteredComplaints.map((c) => (
              <div
                key={c.id}
                className="glass-card"
                style={{ ...panel, padding: '22px', overflow: 'hidden' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px',
                    paddingBottom: '16px',
                    borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 500, color: ui.text, margin: '0 0 4px' }}>
                      {c.students?.profiles?.full_name || 'Unknown Student'}
                    </h3>
                    <p style={{ fontSize: '11px', color: ui.textMuted, margin: '0 0 10px' }}>
                      Roll No: {c.students?.profiles?.id?.substring(0, 8) || '-'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          textTransform: 'capitalize',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: ui.textSoft,
                          border: ui.borderStrong,
                          padding: '2px 10px',
                          borderRadius: '9999px',
                        }}
                      >
                        {c.category}
                      </span>
                      {c.is_urgent && <Badge variant="danger">URGENT</Badge>}
                      {c.ai_classified === true && (
                        <span
                          style={{
                            background: 'rgba(124,92,252,0.12)',
                            border: '0.5px solid rgba(124,92,252,0.25)',
                            color: ui.accent,
                            fontSize: '11px',
                            padding: '2px 10px',
                            borderRadius: '9999px',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Bot size={12} /> AI</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: ui.textMuted, whiteSpace: 'nowrap' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: '13px',
                    color: ui.textSoft,
                    margin: '0 0 16px',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                  }}
                >
                  {c.description}
                </p>

                {c.ai_summary && (
                  <div
                    style={{
                      marginBottom: '16px',
                      fontSize: '12px',
                      color: ui.textMuted,
                      fontStyle: 'italic',
                    }}
                  >
                    AI Summary: {c.ai_summary}
                  </div>
                )}

                {c.ai_suggested_action && (
                  <div
                    style={{
                      marginBottom: '16px',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '14px 16px',
                      borderRadius: ui.radiusXs,
                      border: ui.border,
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 500, color: ui.textSoft, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lightbulb size={12} /> Suggested Action
                    </div>
                    <div style={{ fontSize: '12px', color: ui.textSoft, lineHeight: 1.5 }}>
                      {c.ai_suggested_action}
                    </div>

                    {c.ai_confidence && (
                      <div
                        style={{
                          marginTop: '8px',
                          fontSize: '10px',
                          fontWeight: 500,
                          color:
                            c.ai_confidence > 0.9
                              ? ui.green
                              : c.ai_confidence > 0.7
                                ? ui.amber
                                : ui.textMuted,
                        }}
                      >
                        {c.ai_confidence > 0.9
                          ? 'High confidence'
                          : c.ai_confidence > 0.7
                            ? 'Medium confidence'
                            : 'Low confidence'}
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '4px',
                    paddingTop: '16px',
                    borderTop: '0.5px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <Badge variant={getStatusVariant(c.status)}>
                    {c.status.replace('_', ' ').toUpperCase()}
                  </Badge>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {c.status === 'open' && (
                      <button
                        onClick={() => handleStatusUpdate(c.id, 'in_progress')}
                        className="btn-primary"
                        style={{ ...buttonPrimary, padding: '7px 14px', fontSize: '12px' }}
                      >
                        Mark In Progress
                      </button>
                    )}
                    {c.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusUpdate(c.id, 'resolved')}
                        style={{
                          background: 'rgba(74,222,128,0.12)',
                          border: '0.5px solid rgba(74,222,128,0.25)',
                          color: ui.green,
                          borderRadius: ui.radiusXs,
                          padding: '7px 14px',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,222,128,0.2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(74,222,128,0.12)')}
                      >
                        Mark Resolved
                      </button>
                    )}
                    {c.status === 'resolved' && (
                      <span style={{ fontSize: '11px', color: ui.textMuted }}>
                        Resolved on {new Date(c.resolution_date || c.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
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
                fetchComplaints(nextPage);
              }}
              className="btn-ghost"
              style={buttonGhost}
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
