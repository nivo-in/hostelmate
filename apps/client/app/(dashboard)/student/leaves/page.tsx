'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { LeaveRequest } from '@/types'

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
      const res = await apiGet('/api/leaves/my');
      if (res.success) setLeaves(res.data || []);
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
    if (reason.length < 20) return setError('Reason must be at least 20 chars');
    
    // Optimistic UI update
    setLeaves(prev => [{
      id: crypto.randomUUID(),
      start_date: start,
      end_date: end,
      reason: reason,
      status: 'pending',
      created_at: new Date().toISOString()
    } as LeaveRequest, ...(prev || [])]);

    try {
      const res = await apiPost('/api/leaves', { start_date: start, end_date: end, reason });
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

  const getStatusVariant = (status: string) => {
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'danger';
    return 'warning';
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Leave Requests" showBack onSignOut={handleSignOut} />
      
      <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input type="date" min={today} value={start} onChange={e => setStart(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input type="date" min={start || today} value={end} onChange={e => setEnd(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} required minLength={20} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full" rows={3} placeholder="Describe your reason (min 20 characters)"></textarea>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-green-600">{success}</p>}
          <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors">Apply Leave</button>
        </form>
      </div>

      <div>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Applied On</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Start Date</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">End Date</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Reason</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center border-b border-gray-50">
                  <EmptyState message="No leave requests yet" />
                </td>
              </tr>
            ) : (
              leaves.map(l => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-gray-500">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-900">{l.start_date}</td>
                  <td className="px-4 py-3 text-gray-900">{l.end_date}</td>
                  <td className="px-4 py-3 text-gray-900 truncate max-w-[200px]" title={l.reason}>
                    {l.reason.substring(0, 50)}{l.reason.length > 50 ? '...' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(l.status)}>
                      {l.status.toUpperCase()}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
