'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { Notice } from '@/types';
import { ui, panel, input, buttonPrimary, container, label } from '@/lib/ui';

export default function WardenNotices() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('all');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchNotices = async () => {
    try {
      const res = await apiGet('/api/v1/notices');
      if (res.success) setNotices(res.data || []);
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return setError('All fields required');

    // Optimistic UI update
    setNotices((prev) => [
      {
        id: crypto.randomUUID(),
        title,
        content,
        posted_by: 'warden',
        target_audience: audience as 'all' | 'students' | 'parents',
        created_at: new Date().toISOString(),
      } as Notice,
      ...(prev || []),
    ]);

    try {
      const res = await apiPost('/api/v1/notices', { title, content, target_audience: audience });
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
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to post notice');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <PageShell>
      <PageHeader title="Notices" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* Post Notice form */}
        <div style={{ ...panel, padding: '24px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: ui.text, margin: '0 0 18px' }}>
            Post Notice
          </h2>
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px' }}
          >
            <div>
              <label style={{ ...label, display: 'block' }}>Target Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="hm-input"
                style={{ ...input, colorScheme: 'dark' }}
              >
                <option value="all">All</option>
                <option value="student">Students</option>
                <option value="parent">Parents</option>
              </select>
            </div>
            <div>
              <label style={{ ...label, display: 'block' }}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                type="text"
                className="hm-input"
                style={input}
              />
            </div>
            <div>
              <label style={{ ...label, display: 'block' }}>Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                className="hm-input"
                style={{ ...input, resize: 'vertical', minHeight: '96px' }}
                rows={4}
              />
            </div>
            {error && <p style={{ fontSize: '12px', color: ui.red, margin: 0 }}>{error}</p>}
            {success && <p style={{ fontSize: '12px', color: ui.green, margin: 0 }}>{success}</p>}
            <button type="submit" className="btn-primary" style={{ ...buttonPrimary, alignSelf: 'flex-start' }}>
              Post Notice
            </button>
          </form>
        </div>

        {/* All Notices */}
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: ui.text, margin: '0 0 16px' }}>
            All Notices
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {notices.length === 0 ? (
              <div style={panel}>
                <EmptyState message="No notices found" icon="📢" />
              </div>
            ) : (
              notices.map((notice) => (
                <div
                  key={notice.id}
                  className="glass-card"
                  style={{ ...panel, padding: '22px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 500, color: ui.text, margin: 0 }}>
                        {notice.title}
                      </h3>
                      <Badge variant={notice.target_audience === 'all' ? 'success' : 'default'}>
                        {notice.target_audience.toUpperCase()}
                      </Badge>
                    </div>
                    <span style={{ fontSize: '11px', color: ui.textMuted, whiteSpace: 'nowrap' }}>
                      {new Date(notice.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '13px',
                      color: ui.textSoft,
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6,
                    }}
                  >
                    {notice.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
