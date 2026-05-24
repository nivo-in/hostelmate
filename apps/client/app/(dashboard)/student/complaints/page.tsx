'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { Complaint } from '@/types'

export default function StudentComplaints() {
  const [category, setCategory] = useState('electrical');
  const [description, setDescription] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchComplaints = async () => {
    try {
      const res = await apiGet('/api/complaints/my');
      if (res.success) setComplaints(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return setError('Description required');
    
    // Optimistic UI update
    setComplaints(prev => [{
      id: crypto.randomUUID(),
      category,
      description,
      is_urgent: urgent,
      status: 'open',
      student_id: 'pending',
      resolved_by: '',
      resolution_date: '',
      created_at: new Date().toISOString()
    } as Complaint, ...(prev || [])]);

    try {
      const res = await apiPost('/api/complaints', { category, description, is_urgent: urgent });
      if (res.success) {
        setCategory('electrical');
        setDescription('');
        setUrgent(false);
        setError('');
        setSuccess('Complaint submitted successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(res.error || 'Failed to submit complaint');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to submit complaint');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const getStatusVariant = (status: string) => {
    if (status === 'resolved') return 'success';
    if (status === 'open') return 'danger';
    return 'warning';
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Complaints" showBack onSignOut={handleSignOut} />
      
      <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full bg-white">
              <option value="electrical">Electrical</option>
              <option value="plumbing">Plumbing</option>
              <option value="furniture">Furniture</option>
              <option value="cleaning">Cleaning</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full" rows={3}></textarea>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={() => setUrgent(!urgent)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${urgent ? 'bg-gray-900' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${urgent ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
            <label className="text-sm text-gray-900 cursor-pointer" onClick={() => setUrgent(!urgent)}>Mark as urgent</label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-green-600">{success}</p>}
          <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors">Submit Complaint</button>
        </form>
      </div>

      <div className="space-y-4">
        {complaints.length === 0 ? (
          <div className="border border-gray-100 rounded-xl p-8">
            <EmptyState message="No complaints raised yet" />
          </div>
        ) : (
          complaints.map(c => (
            <div key={c.id} className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors bg-white">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="capitalize text-sm font-medium text-gray-900">{c.category}</span>
                  {c.is_urgent && <Badge variant="danger">URGENT</Badge>}
                </div>
                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">{c.description}</p>
              <div className="flex justify-end">
                <Badge variant={getStatusVariant(c.status)}>
                  {c.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
