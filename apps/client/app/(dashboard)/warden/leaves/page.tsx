'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { LeaveWithStudent } from '@/types'

export default function WardenLeaves() {
  const [activeTab, setActiveTab] = useState('All');
  const [leaves, setLeaves] = useState<LeaveWithStudent[]>([]);
  const [message, setMessage] = useState('');
  
  const { apiGet, apiPatch } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchLeaves = async () => {
    try {
      const res = await apiGet('/api/leaves/all');
      if (res.success) setLeaves(res.data || []);
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await apiPatch(`/api/leaves/${id}/${action}`, {});
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
    window.location.href = '/login';
  };

  const getStatusVariant = (status: string) => {
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'danger';
    return 'warning';
  };

  const filteredLeaves = leaves.filter(l => {
    if (activeTab === 'All') return true;
    return l.status.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Leave Management" showBack onSignOut={handleSignOut} />
      
      {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">{message}</div>}

      <div className="flex gap-4 border-b border-gray-100 mb-8 pb-2 overflow-x-auto no-scrollbar">
        {['All', 'Pending', 'Approved', 'Rejected'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-1 py-1 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-gray-100 rounded-xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Student Name</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Roll No</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Duration</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Reason</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Applied On</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeaves.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center border-b border-gray-50">
                  <EmptyState message={`No ${activeTab !== 'All' ? activeTab.toLowerCase() : ''} leave requests`} />
                </td>
              </tr>
            ) : (
              filteredLeaves.map(l => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{l.students?.profiles?.full_name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-gray-500">{l.students?.profiles?.id?.substring(0, 8) || '-'}</td>
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{l.start_date} to {l.end_date}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate" title={l.reason}>{l.reason}</td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(l.status)}>
                      {l.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {l.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleAction(l.id, 'approve')} className="bg-green-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-green-600 transition-colors">Approve</button>
                        <button onClick={() => handleAction(l.id, 'reject')} className="bg-red-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-600 transition-colors">Reject</button>
                      </div>
                    )}
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
