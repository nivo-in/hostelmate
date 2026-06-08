'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { Notice } from '@/types';

export default function StudentNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const { apiGet } = useApi();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const res = await apiGet('/api/v1/notices');
        if (res.success) setNotices(res.data);
      } catch {
        // Silently fail
      }
    };
    fetchNotices();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Notices" showBack onSignOut={handleSignOut} />

      <div className="space-y-0">
        {notices.length === 0 ? (
          <div className="border border-gray-100 rounded-xl p-8">
            <EmptyState message="No notices yet" />
          </div>
        ) : (
          notices.map((notice) => (
            <div key={notice.id} className="border-b border-gray-50 py-4">
              <h3 className="text-sm font-medium text-gray-900">{notice.title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(notice.created_at).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{notice.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
