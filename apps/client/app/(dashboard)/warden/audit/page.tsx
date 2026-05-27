'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useApi } from '@/hooks/useApi';
import { createClient } from '@/lib/supabase/client';

type AuditLog = {
  id: string;
  created_at: string;
  user_name: string;
  action: string;
  resource: string;
  details: Record<string, unknown> | string | null;
};

export default function WardenAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(0);

  // Filters
  const [resourceFilter, setResourceFilter] = useState('all');
  const [searchAction, setSearchAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { apiGet } = useApi();
  const supabase = createClient();

  // Stable ref to avoid re-render loops
  const apiGetRef = useRef(apiGet);
  useEffect(() => { apiGetRef.current = apiGet; });

  useEffect(() => { 
    setMounted(true); 
    setNow(Date.now());
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = `/api/audit?limit=50`;
      if (resourceFilter !== 'all') {
        query += `&resource=${resourceFilter}`;
      }
      const res = await apiGetRef.current(query);
      if (res.success && res.data) {
        setLogs(res.data as AuditLog[]);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error('Audit fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [resourceFilter]); // resourceFilter is a primitive — safe dep

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter(log => {
    const matchAction = log.action.toLowerCase().includes(searchAction.toLowerCase());

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

    return matchAction && matchDate;
  });

  const getActionBadge = (action: string) => {
    const actionLower = action.toLowerCase();
    let bg = 'bg-gray-50';
    let text = 'text-gray-600';

    if (actionLower.includes('attendance')) {
      bg = 'bg-green-50'; text = 'text-green-600';
    } else if (actionLower.includes('approve_leave')) {
      bg = 'bg-blue-50'; text = 'text-blue-600';
    } else if (actionLower.includes('reject_leave')) {
      bg = 'bg-red-50'; text = 'text-red-600';
    } else if (actionLower.includes('complaint')) {
      bg = 'bg-yellow-50'; text = 'text-yellow-600';
    } else if (actionLower.includes('notice')) {
      bg = 'bg-purple-50'; text = 'text-purple-600';
    } else if (actionLower.includes('assign_room') || actionLower.includes('transfer')) {
      bg = 'bg-teal-50'; text = 'text-teal-600';
    }

    return (
      <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${bg} ${text}`}>
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

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Audit Log" showBack={true} onSignOut={handleSignOut} />

      {/* Error */}
      {error && (
        <div className="border border-red-100 rounded-xl p-4 bg-red-50 mb-6 flex items-center justify-between">
          <span className="text-sm text-red-600">{error}</span>
          <button
            onClick={fetchLogs}
            className="text-xs text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Resource</label>
          <select
            value={resourceFilter}
            onChange={e => setResourceFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full bg-white"
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
          <label className="block text-xs text-gray-500 mb-1">Action Search</label>
          <input
            type="text"
            placeholder="e.g. mark_attendance"
            value={searchAction}
            onChange={e => setSearchAction(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
                <th className="px-6 py-3 whitespace-nowrap">Time</th>
                <th className="px-6 py-3 whitespace-nowrap">User</th>
                <th className="px-6 py-3 whitespace-nowrap">Action</th>
                <th className="px-6 py-3 whitespace-nowrap">Resource</th>
                <th className="px-6 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-16" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                    <td className="px-6 py-4"><div className="h-5 bg-gray-100 rounded-full w-20" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-16" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-32" /></td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isExpanded = expandedRow === log.id;
                  const detailsStr =
                    typeof log.details === 'string'
                      ? log.details
                      : JSON.stringify(log.details);
                  const isLongDetails = detailsStr.length > 30;

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="text-sm text-gray-600 cursor-help"
                          title={formatFullDate(log.created_at)}
                        >
                          {getRelativeTime(log.created_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {log.user_name || 'System'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.resource}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px]">
                        <div
                          className={`font-mono text-[10px] bg-gray-50 border border-gray-100 p-2 rounded ${
                            isExpanded ? '' : 'truncate'
                          } ${isLongDetails ? 'cursor-pointer hover:border-gray-200' : ''}`}
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
    </div>
  );
}
