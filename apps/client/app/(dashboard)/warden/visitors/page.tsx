'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { ui, panel, panelElevated, input, buttonGhost, container } from '@/lib/ui';

interface Visitor {
  id: string;
  visitor_name: string;
  relationship: string;
  purpose: string;
  expected_visit_date: string;
  status: string;
  warden_notes?: string;
  created_at: string;
  students?: {
    profiles?: {
      full_name?: string;
    };
  };
}

export default function WardenVisitors() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [filter, setFilter] = useState('All');
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const { apiGet, apiPatch } = useApi();
  const supabase = createClient();

  const fetchVisitors = async (currentPage = 1, searchQuery = '') => {
    try {
      const url = new URL('/api/v1/visitors', window.location.origin);
      url.searchParams.set('page', currentPage.toString());
      url.searchParams.set('limit', '20');
      if (searchQuery) {
        url.searchParams.set('search', searchQuery);
      }
      const res = await apiGet(url.pathname + url.search);
      if (res.success) {
        if (currentPage === 1) {
          setVisitors(res.data || []);
        } else {
          setVisitors((prev) => [...prev, ...(res.data || [])]);
        }
        setHasNext(res.pagination?.hasNext || false);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchVisitors(1, debouncedSearch);
  }, [debouncedSearch]);

  const handleAction = async (id: string, action: string, notesParam?: string) => {
    try {
      const payload = notesParam !== undefined ? { warden_notes: notesParam } : {};
      const res = await apiPatch(`/api/v1/visitors/${id}/${action}`, payload);
      if (res.success) {
        setActionId(null);
        setActionType(null);
        setNotes('');
        fetchVisitors(page, debouncedSearch);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();

  const pendingCount = visitors.filter((v) => v.status === 'pending').length;
  const todayCount = visitors.filter((v) => v.expected_visit_date === todayStr).length;
  const checkedInCount = visitors.filter((v) => v.status === 'checked_in').length;
  const monthCount = visitors.filter(
    (v) => new Date(v.created_at).getMonth() === currentMonth
  ).length;

  const filteredVisitors = visitors.filter((v) => {
    if (filter === 'All') return true;
    if (filter === 'Pending') return v.status === 'pending';
    if (filter === 'Approved') return v.status === 'approved';
    if (filter === 'Checked In') return v.status === 'checked_in';
    if (filter === 'Today') return v.expected_visit_date === todayStr;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      case 'checked_in':
        return <Badge variant="info">Checked In</Badge>;
      case 'checked_out':
        return <Badge variant="default">Checked Out</Badge>;
      default:
        return null;
    }
  };

  const statTiles = [
    { label: 'Pending Requests', value: pendingCount, color: ui.amber },
    { label: "Today's Expected Visitors", value: todayCount, color: ui.blue },
    { label: 'Currently Checked In', value: checkedInCount, color: ui.green },
    { label: 'Total This Month', value: monthCount, color: ui.text },
  ];

  return (
    <PageShell>
      <PageHeader title="Visitor Management" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* Stats row */}
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}
          className="vis-stats"
        >
          {statTiles.map((t) => (
            <div key={t.label} style={{ ...panelElevated, padding: '16px 18px' }}>
              <div style={{ fontSize: '11px', color: ui.textMuted, marginBottom: '8px' }}>{t.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: t.color, fontVariantNumeric: 'tabular-nums' }}>
                {t.value}
              </div>
            </div>
          ))}
        </div>

        {/* Search and Filters */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '380px' }}>
            <input
              type="text"
              placeholder="Search by visitor name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="hm-input"
              style={{ ...input, paddingLeft: '36px' }}
            />
            <svg
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                color: ui.textMuted,
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
            {['All', 'Pending', 'Approved', 'Checked In', 'Today'].map((tab) => {
              const active = filter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  style={{
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    background: active ? 'rgba(124,92,252,0.12)' : 'rgba(255,255,255,0.04)',
                    border: active ? '0.5px solid rgba(124,92,252,0.3)' : '0.5px solid rgba(255,255,255,0.08)',
                    borderRadius: '9999px',
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
        </div>

        {/* Visitor list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredVisitors.length === 0 ? (
            <div style={{ ...panel }}>
              <EmptyState message="No visitors found" icon="🚪" />
            </div>
          ) : (
            filteredVisitors.map((v) => (
              <div key={v.id} className="glass-card" style={{ ...panel, padding: '20px 22px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Left side */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: ui.text }}>{v.visitor_name}</span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 9px',
                          borderRadius: '9999px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '0.5px solid rgba(255,255,255,0.1)',
                          color: ui.textSoft,
                          textTransform: 'capitalize',
                        }}
                      >
                        {v.relationship}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: ui.textMuted }}>
                      For: {v.students?.profiles?.full_name || 'Unknown Student'}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: ui.textFaint,
                        maxWidth: '28rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {v.purpose}
                    </div>
                  </div>

                  {/* Right side */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '12px', color: ui.textMuted }}>{v.expected_visit_date}</div>
                      {getStatusBadge(v.status)}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      {v.status === 'pending' && actionId !== v.id && (
                        <>
                          <button
                            onClick={() => {
                              setActionId(v.id);
                              setActionType('approve');
                            }}
                            style={{
                              fontSize: '12px',
                              padding: '6px 12px',
                              borderRadius: ui.radiusXs,
                              border: '0.5px solid rgba(74,222,128,0.25)',
                              background: 'rgba(74,222,128,0.12)',
                              color: ui.green,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,222,128,0.2)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(74,222,128,0.12)')}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setActionId(v.id);
                              setActionType('reject');
                            }}
                            style={{
                              fontSize: '12px',
                              padding: '6px 12px',
                              borderRadius: ui.radiusXs,
                              border: '0.5px solid rgba(248,113,113,0.25)',
                              background: 'rgba(248,113,113,0.12)',
                              color: ui.red,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.2)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.12)')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {v.status === 'approved' && (
                        <button
                          onClick={() => handleAction(v.id, 'checkin')}
                          style={{
                            fontSize: '12px',
                            padding: '6px 16px',
                            borderRadius: ui.radiusXs,
                            border: '0.5px solid rgba(96,165,250,0.25)',
                            background: 'rgba(96,165,250,0.12)',
                            color: ui.blue,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(96,165,250,0.2)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(96,165,250,0.12)')}
                        >
                          Check In
                        </button>
                      )}
                      {v.status === 'checked_in' && (
                        <button
                          onClick={() => handleAction(v.id, 'checkout')}
                          className="btn-ghost"
                          style={{ ...buttonGhost, fontSize: '12px', padding: '6px 16px' }}
                        >
                          Check Out
                        </button>
                      )}
                    </div>

                    {/* Inline Action Notes Form */}
                    {actionId === v.id && actionType && (
                      <div style={{ marginTop: '8px', width: '100%', maxWidth: '20rem', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add notes (optional)"
                          className="hm-input"
                          style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
                          rows={2}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button
                            onClick={() => {
                              setActionId(null);
                              setActionType(null);
                              setNotes('');
                            }}
                            style={{
                              fontSize: '12px',
                              color: ui.textMuted,
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'color 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = ui.text)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = ui.textMuted)}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAction(v.id, actionType, notes)}
                            style={{
                              fontSize: '12px',
                              padding: '6px 12px',
                              borderRadius: ui.radiusXs,
                              border:
                                actionType === 'approve'
                                  ? '0.5px solid rgba(74,222,128,0.25)'
                                  : '0.5px solid rgba(248,113,113,0.25)',
                              background:
                                actionType === 'approve' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                              color: actionType === 'approve' ? ui.green : ui.red,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                          >
                            Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
                          </button>
                        </div>
                      </div>
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
                fetchVisitors(nextPage, debouncedSearch);
              }}
              className="btn-ghost"
              style={buttonGhost}
            >
              Load more
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .vis-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </PageShell>
  );
}
