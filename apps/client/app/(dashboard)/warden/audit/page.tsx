'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi } from '@/hooks/useApi';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { ui, panel, input, buttonGhost, container, label } from '@/lib/ui';

type AuditLog = {
  id: string;
  created_at: string;
  user_name: string;
  action: string;
  resource: string;
  details: Record<string, unknown> | string | null;
};

export default function WardenAuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  // Filters
  const [resourceFilter, setResourceFilter] = useState('all');
  const [searchAction, setSearchAction] = useState('');
  const debouncedSearchAction = useDebounce(searchAction, 300);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { apiGet } = useApi();
  const supabase = createClient();

  // Stable ref to avoid re-render loops
  const apiGetRef = useRef(apiGet);
  useEffect(() => {
    apiGetRef.current = apiGet;
  });

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const fetchLogs = useCallback(
    async (currentPage = 1) => {
      setLoading(true);
      setError(null);
      try {
        let query = `/api/v1/audit?page=${currentPage}&limit=50`;
        if (resourceFilter !== 'all') {
          query += `&resource=${resourceFilter}`;
        }
        if (debouncedSearchAction) {
          query += `&action=${encodeURIComponent(debouncedSearchAction)}`;
        }
        const res = await apiGetRef.current(query);
        if (res.success && res.data) {
          if (currentPage === 1) {
            setLogs(res.data as AuditLog[]);
          } else {
            setLogs((prev) => [...prev, ...(res.data as AuditLog[])]);
          }
          setHasNext(res.pagination?.hasNext || false);
        } else if (currentPage === 1) {
          setLogs([]);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Audit fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    },
    [resourceFilter]
  ); // resourceFilter is a primitive — safe dep

  useEffect(() => {
    setPage(1);
    fetchLogs(1);
  }, [fetchLogs, debouncedSearchAction]);

  const filteredLogs = logs.filter((log) => {
    let matchDate = true;
    if (dateFrom || dateTo) {
      const logDate = new Date(log.created_at);
      if (dateFrom) {
        matchDate = matchDate && logDate >= new Date(dateFrom);
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        matchDate = matchDate && logDate < to;
      }
    }

    return matchDate;
  });

  const getActionBadge = (action: string) => {
    const actionLower = action.toLowerCase();
    let bg = 'rgba(255,255,255,0.08)';
    let text: string = ui.textSoft;
    let border = 'rgba(255,255,255,0.12)';

    if (actionLower.includes('attendance')) {
      bg = 'rgba(74,222,128,0.12)';
      text = ui.green;
      border = 'rgba(74,222,128,0.25)';
    } else if (actionLower.includes('approve_leave')) {
      bg = 'rgba(96,165,250,0.12)';
      text = ui.blue;
      border = 'rgba(96,165,250,0.25)';
    } else if (actionLower.includes('reject_leave')) {
      bg = 'rgba(248,113,113,0.12)';
      text = ui.red;
      border = 'rgba(248,113,113,0.25)';
    } else if (actionLower.includes('complaint')) {
      bg = 'rgba(251,191,36,0.12)';
      text = ui.amber;
      border = 'rgba(251,191,36,0.25)';
    } else if (actionLower.includes('notice')) {
      bg = 'rgba(167,139,250,0.12)';
      text = '#a78bfa';
      border = 'rgba(167,139,250,0.25)';
    } else if (actionLower.includes('assign_room') || actionLower.includes('transfer')) {
      bg = 'rgba(45,212,191,0.12)';
      text = '#2dd4bf';
      border = 'rgba(45,212,191,0.25)';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: '10px',
          fontWeight: 500,
          padding: '3px 9px',
          borderRadius: '9999px',
          whiteSpace: 'nowrap',
          background: bg,
          color: text,
          border: `0.5px solid ${border}`,
        }}
      >
        {action}
      </span>
    );
  };

  // Hydration-safe: only runs on client after mount
  const getRelativeTime = (dateString: string): string => {
    if (!mounted || !now) return '—';
    const date = new Date(dateString);
    const diffMs = now - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatFullDate = (dateString: string): string => {
    if (!mounted) return '';
    return new Date(dateString).toLocaleString();
  };

  const th: React.CSSProperties = {
    padding: '12px 24px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 500,
    color: ui.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  };

  return (
    <PageShell>
      <PageHeader title="Audit Log" showBack={true} onSignOut={handleSignOut} />

      <div style={container}>
        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.25)', borderRadius: ui.radius, padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: ui.red }}>{error}</span>
            <button
              onClick={() => fetchLogs(1)}
              style={{ fontSize: '12px', color: ui.red, background: 'transparent', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <div style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }} className="audit-filters">
          <div>
            <label style={{ ...label, display: 'block' }}>Resource</label>
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="hm-input"
              style={{ ...input, colorScheme: 'dark' }}
            >
              <option value="all">All</option>
              <option value="attendance">Attendance</option>
              <option value="leave_request">Leave Request</option>
              <option value="complaint">Complaint</option>
              <option value="notice">Notice</option>
              <option value="room">Room</option>
            </select>
          </div>
          <div>
            <label style={{ ...label, display: 'block' }}>Action Search</label>
            <input
              type="text"
              placeholder="e.g. mark_attendance"
              value={searchAction}
              onChange={(e) => setSearchAction(e.target.value)}
              className="hm-input"
              style={input}
            />
          </div>
          <div>
            <label style={{ ...label, display: 'block' }}>From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="hm-input"
              style={{ ...input, colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label style={{ ...label, display: 'block' }}>To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="hm-input"
              style={{ ...input, colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ ...panel, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: ui.border }}>
                  <th style={th}>Time</th>
                  <th style={th}>User</th>
                  <th style={th}>Action</th>
                  <th style={th}>Resource</th>
                  <th style={{ ...th, whiteSpace: 'normal' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                      {[64, 96, 80, 64, 128].map((w, j) => (
                        <td key={j} style={{ padding: '16px 24px' }}>
                          <div style={{ height: '16px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: `${w}px`, animation: 'hmPulse 1.4s ease-in-out infinite' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyStateRow />
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isExpanded = expandedRow === log.id;
                    const detailsStr =
                      typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
                    const isLongDetails = detailsStr.length > 30;

                    return (
                      <tr
                        key={log.id}
                        className="row-hover"
                        style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}
                      >
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{ fontSize: '13px', color: ui.textMuted, cursor: 'help' }}
                            title={formatFullDate(log.created_at)}
                          >
                            {getRelativeTime(log.created_at)}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '13px', color: ui.text, fontWeight: 500 }}>
                          {log.user_name || 'System'}
                        </td>
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>{getActionBadge(log.action)}</td>
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '13px', color: ui.textMuted }}>
                          {log.resource}
                        </td>
                        <td style={{ padding: '16px 24px', fontSize: '13px', maxWidth: '200px' }}>
                          <div
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '10px',
                              background: 'rgba(255,255,255,0.04)',
                              border: ui.border,
                              padding: '8px',
                              borderRadius: '8px',
                              color: ui.textSoft,
                              overflow: isExpanded ? 'visible' : 'hidden',
                              textOverflow: isExpanded ? 'clip' : 'ellipsis',
                              whiteSpace: isExpanded ? 'normal' : 'nowrap',
                              wordBreak: isExpanded ? 'break-all' : 'normal',
                              cursor: isLongDetails ? 'pointer' : 'default',
                            }}
                            onClick={() =>
                              isLongDetails && setExpandedRow(isExpanded ? null : log.id)
                            }
                          >
                            {detailsStr}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {hasNext && (
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchLogs(nextPage);
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
        @keyframes hmPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media (max-width: 720px) {
          .audit-filters { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </PageShell>
  );
}

function EmptyStateRow() {
  return <EmptyState message="No audit logs found." icon="🛡️" />;
}
