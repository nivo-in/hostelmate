'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { AiAnalysisCard } from '@/components/ui/AiAnalysisCard';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { LeaveWithStudent } from '@/types';
import { ui, panel, buttonGhost, container } from '@/lib/ui';
import { Calendar } from 'lucide-react';

export default function WardenLeaves() {
  const [activeTab, setActiveTab] = useState('All');
  const [leaves, setLeaves] = useState<LeaveWithStudent[]>([]);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const { apiGet, apiPatch } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchLeaves = async (currentPage = 1) => {
    try {
      const res = await apiGet(`/api/v1/leaves/all?page=${currentPage}&limit=20`);
      if (res.success) {
        if (currentPage === 1) {
          setLeaves(res.data || []);
        } else {
          setLeaves((prev) => [...prev, ...(res.data || [])]);
        }
        setHasNext(res.pagination?.hasNext || false);
      }
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchLeaves(1);
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await apiPatch(`/api/v1/leaves/${id}/${action}`, {});
      if (res.success) {
        setMessage(`Leave request ${action}d successfully`);
        fetchLeaves();
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
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'danger';
    return 'warning';
  };

  const filteredLeaves = leaves.filter((l) => {
    if (activeTab === 'All') return true;
    return l.status.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <PageShell>
      <PageHeader title="Leave Management" showBack onSignOut={handleSignOut} />

      <div style={container}>
        <div style={{ marginBottom: 24 }}>
          <AiAnalysisCard type="leaves" themeColor="#7c5cfc" themeRgb="124,92,252" />
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
          {['All', 'Pending', 'Approved', 'Rejected'].map((tab) => {
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
                  if (!active) e.currentTarget.style.color = ui.textSoft;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.color = ui.textMuted;
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ ...panel, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: ui.border }}>
                {['Student Name', 'Roll No', 'Duration', 'Reason', 'Status', 'Applied On', 'Actions'].map((h) => (
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
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      message={`No ${activeTab !== 'All' ? activeTab.toLowerCase() : ''} leave requests`}
                      icon={<Calendar strokeWidth={1.5} />}
                    />
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((l) => (
                  <tr
                    key={l.id}
                    className="row-hover"
                    style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}
                  >
                    <td style={{ padding: '12px 18px', color: ui.text, fontWeight: 500 }}>
                      {l.students?.profiles?.full_name || 'Unknown'}
                    </td>
                    <td style={{ padding: '12px 18px', color: ui.textMuted }}>
                      {l.students?.profiles?.id?.substring(0, 8) || '-'}
                    </td>
                    <td style={{ padding: '12px 18px', color: ui.textSoft, whiteSpace: 'nowrap' }}>
                      {new Date(l.start_date).toLocaleDateString()} to {new Date(l.end_date).toLocaleDateString()}
                    </td>
                    <td
                      style={{
                        padding: '12px 18px',
                        color: ui.textSoft,
                        maxWidth: '150px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={l.reason}
                    >
                      {l.reason}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <Badge variant={getStatusVariant(l.status)}>{l.status.toUpperCase()}</Badge>
                    </td>
                    <td style={{ padding: '12px 18px', color: ui.textMuted, whiteSpace: 'nowrap' }}>
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      {l.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleAction(l.id, 'approve')}
                            style={{
                              background: 'rgba(74,222,128,0.12)',
                              border: '0.5px solid rgba(74,222,128,0.25)',
                              color: ui.green,
                              borderRadius: ui.radiusXs,
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,222,128,0.2)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(74,222,128,0.12)')}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(l.id, 'reject')}
                            style={{
                              background: 'rgba(248,113,113,0.12)',
                              border: '0.5px solid rgba(248,113,113,0.25)',
                              color: ui.red,
                              borderRadius: ui.radiusXs,
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.2)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.12)')}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasNext && (
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchLeaves(nextPage);
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
