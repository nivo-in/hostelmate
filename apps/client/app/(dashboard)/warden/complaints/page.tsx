'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { ComplaintWithStudent } from '@/types'

export default function WardenComplaints() {
  const [activeTab, setActiveTab] = useState('All');
  const [complaints, setComplaints] = useState<ComplaintWithStudent[]>([]);
  const [message, setMessage] = useState('');
  
  const { apiGet, apiPatch } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchComplaints = async () => {
    try {
      const res = await apiGet('/api/complaints/all');
      if (res.success) setComplaints(res.data || []);
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const res = await apiPatch(`/api/complaints/${id}/status`, { status });
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
    if (status === 'resolved') return 'success';
    if (status === 'open') return 'danger';
    return 'warning';
  };

  const filteredComplaints = complaints.filter(c => {
    if (activeTab === 'All') return true;
    if (activeTab === 'In Progress') return c.status === 'in_progress';
    return c.status.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <PageHeader title="Complaints" showBack onSignOut={handleSignOut} />
        <button 
          onClick={() => router.push('/warden/complaints/analytics')}
          className="text-sm font-medium text-gray-900 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors border border-gray-200"
        >
          View Analytics →
        </button>
      </div>
      
      {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">{message}</div>}

      <div className="flex gap-4 border-b border-gray-100 mb-8 pb-2 overflow-x-auto no-scrollbar">
        {['All', 'Open', 'In Progress', 'Resolved'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-1 py-1 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredComplaints.length === 0 ? (
          <div className="border border-gray-100 rounded-xl p-8">
            <EmptyState message={`No ${activeTab !== 'All' ? activeTab.toLowerCase() : ''} complaints found`} />
          </div>
        ) : (
          filteredComplaints.map(c => (
            <div key={c.id} className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors bg-white">
              <div className="flex justify-between items-start mb-4 border-b border-gray-50 pb-4">
                <div>
                  <h3 className="font-medium text-gray-900">{c.students?.profiles?.full_name || 'Unknown Student'}</h3>
                  <p className="text-xs text-gray-500 mb-2">Roll No: {c.students?.profiles?.id?.substring(0, 8) || '-'}</p>
                  <div className="flex items-center gap-2">
                    <span className="capitalize text-xs font-medium text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full">{c.category}</span>
                    {c.is_urgent && <Badge variant="danger">URGENT</Badge>}
                    {c.ai_classified === true && <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full">🤖 AI</span>}
                  </div>
                </div>
                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap">{c.description}</p>
              
              {c.ai_summary && (
                <div className="mb-4 text-xs text-gray-500 italic">
                  AI Summary: {c.ai_summary}
                </div>
              )}

              {c.ai_suggested_action && (
                <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="text-xs font-medium text-gray-600 mb-1">💡 Suggested Action</div>
                  <div className="text-xs text-gray-600">{c.ai_suggested_action}</div>
                  
                  {c.ai_confidence && (
                    <div className={`mt-2 text-[10px] font-medium ${c.ai_confidence > 0.9 ? 'text-green-600' : c.ai_confidence > 0.7 ? 'text-yellow-600' : 'text-gray-500'}`}>
                      {c.ai_confidence > 0.9 ? 'High confidence' : c.ai_confidence > 0.7 ? 'Medium confidence' : 'Low confidence'}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex justify-between items-center bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-xl border-t border-gray-100">
                <Badge variant={getStatusVariant(c.status)}>
                  {c.status.replace('_', ' ').toUpperCase()}
                </Badge>
                
                <div className="flex gap-2">
                  {c.status === 'open' && (
                    <button onClick={() => handleStatusUpdate(c.id, 'in_progress')} className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-700 transition-colors">
                      Mark In Progress
                    </button>
                  )}
                  {c.status === 'in_progress' && (
                    <button onClick={() => handleStatusUpdate(c.id, 'resolved')} className="bg-green-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-green-600 transition-colors">
                      Mark Resolved
                    </button>
                  )}
                  {c.status === 'resolved' && (
                    <span className="text-xs text-gray-500">Resolved on {new Date(c.resolution_date || c.created_at).toLocaleDateString()}</span>
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
