'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';

export default function WardenNotices() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('all');
  const [notices, setNotices] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchNotices = async () => {
    try {
      const res = await apiGet('/api/notices');
      if (res.success) setNotices(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return setError('All fields required');
    
    // Optimistic UI update
    setNotices(prev => [{
      id: crypto.randomUUID(),
      title,
      content,
      target_audience: audience,
      created_at: new Date().toISOString()
    }, ...(prev || [])]);

    try {
      const res = await apiPost('/api/notices', { title, content, target_audience: audience });
      if (res.success) {
        setTitle('');
        setContent('');
        setAudience('all');
        setError('');
        setSuccess('Notice posted successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(res.error || 'Failed to post notice');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to post notice');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Notices" showBack onSignOut={handleSignOut} />
      
      <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
        <h2 className="text-sm font-medium text-gray-900 mb-4">Post Notice</h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Target Audience</label>
            <select value={audience} onChange={e => setAudience(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full bg-white">
              <option value="all">All</option>
              <option value="student">Students</option>
              <option value="parent">Parents</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required type="text" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Content</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full" rows={4}></textarea>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-green-600">{success}</p>}
          <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors">Post Notice</button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">All Notices</h2>
        <div className="space-y-4">
          {notices.length === 0 ? (
            <div className="border border-gray-100 rounded-xl p-8">
              <EmptyState message="No notices found" />
            </div>
          ) : (
            notices.map(notice => (
              <div key={notice.id} className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{notice.title}</h3>
                    <Badge variant={notice.target_audience === 'all' ? 'success' : 'default'}>
                      {notice.target_audience.toUpperCase()}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(notice.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{notice.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
