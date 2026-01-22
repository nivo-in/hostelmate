'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';

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

  const { apiGet, apiPatch } = useApi();
  const supabase = createClient();

  const fetchVisitors = async () => {
    try {
      const res = await apiGet('/api/visitors');
      if (res.success) setVisitors(res.data || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const handleAction = async (id: string, action: string, notesParam?: string) => {
    try {
      const payload = notesParam !== undefined ? { warden_notes: notesParam } : {};
      const res = await apiPatch(`/api/visitors/${id}/${action}`, payload);
      if (res.success) {
        setActionId(null);
        setActionType(null);
        setNotes('');
        fetchVisitors();
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
    const base = 'text-xs px-2.5 py-1 rounded-full font-medium';
    switch (status) {
      case 'pending':
        return <span className={`${base} bg-yellow-50 text-yellow-700`}>Pending</span>;
      case 'approved':
        return <span className={`${base} bg-green-50 text-green-700`}>Approved</span>;
      case 'rejected':
        return <span className={`${base} bg-red-50 text-red-700`}>Rejected</span>;
      case 'checked_in':
        return <span className={`${base} bg-blue-50 text-blue-700`}>Checked In</span>;
      case 'checked_out':
        return <span className={`${base} bg-gray-50 text-gray-600`}>Checked Out</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-5xl mx-auto">
      <PageHeader title="Visitor Management" showBack onSignOut={handleSignOut} />

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="border border-yellow-100 bg-yellow-50/30 rounded-xl p-4">
          <div className="text-xs text-yellow-600 font-medium mb-1">Pending Requests</div>
          <div className="text-2xl font-semibold text-gray-900">{pendingCount}</div>
        </div>
        <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-4">
          <div className="text-xs text-blue-600 font-medium mb-1">
            Today&apos;s Expected Visitors
          </div>
          <div className="text-2xl font-semibold text-gray-900">{todayCount}</div>
        </div>
        <div className="border border-green-100 bg-green-50/30 rounded-xl p-4">
          <div className="text-xs text-green-600 font-medium mb-1">Currently Checked In</div>
          <div className="text-2xl font-semibold text-gray-900">{checkedInCount}</div>
        </div>
        <div className="border border-gray-100 bg-gray-50/30 rounded-xl p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Total This Month</div>
          <div className="text-2xl font-semibold text-gray-900">{monthCount}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['All', 'Pending', 'Approved', 'Checked In', 'Today'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === tab
                ? 'bg-gray-900 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Visitor list */}
      <div className="space-y-4">
        {filteredVisitors.length === 0 ? (
          <div className="border border-gray-100 rounded-xl p-8">
            <EmptyState message="No visitors found" />
          </div>
        ) : (
          filteredVisitors.map((v) => (
            <div
              key={v.id}
              className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors"
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                {/* Left side */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{v.visitor_name}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
                      {v.relationship}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    For: {v.students?.profiles?.full_name || 'Unknown Student'}
                  </div>
                  <div className="text-xs text-gray-400 truncate max-w-md">{v.purpose}</div>
                </div>

                {/* Right side */}
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-400">{v.expected_visit_date}</div>
                    {getStatusBadge(v.status)}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-2">
                    {v.status === 'pending' && actionId !== v.id && (
                      <>
                        <button
                          onClick={() => {
                            setActionId(v.id);
                            setActionType('approve');
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setActionId(v.id);
                            setActionType('reject');
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {v.status === 'approved' && (
                      <button
                        onClick={() => handleAction(v.id, 'checkin')}
                        className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        Check In
                      </button>
                    )}
                    {v.status === 'checked_in' && (
                      <button
                        onClick={() => handleAction(v.id, 'checkout')}
                        className="text-xs px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Check Out
                      </button>
                    )}
                  </div>

                  {/* Inline Action Notes Form */}
                  {actionId === v.id && actionType && (
                    <div className="mt-2 w-full max-w-xs text-right space-y-2">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes (optional)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-500"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setActionId(null);
                            setActionType(null);
                            setNotes('');
                          }}
                          className="text-xs text-gray-500 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAction(v.id, actionType, notes)}
                          className={`text-xs px-3 py-1.5 rounded-lg text-white ${actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
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
    </div>
  );
}
