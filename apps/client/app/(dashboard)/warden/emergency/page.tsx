'use client';
import { Siren } from 'lucide-react';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { Notice } from '@/types';
import { ui, container, sectionTitle } from '@/lib/ui';

export default function EmergencyAlert() {
  const router = useRouter();
  const supabase = createClient();
  const { apiPost, apiGet } = useApi();

  const [message, setMessage] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [confirming, setConfirming] = useState(false);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/v1/notices');
      if (res.success) {
        setNotices((res.data || []).filter((n: Notice) => n.title?.includes('EMERGENCY')));
      }
    } catch {
      setNotices([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const sendAlert = async () => {
    setConfirming(false);
    setSending(true);
    setSuccess('');

    try {
      const res = await apiPost('/api/v1/notices', {
        title: 'EMERGENCY ALERT',
        content: message,
        target_audience: 'all',
      });

      if (res.success) {
        setSuccess('Alert sent to all students');
        setMessage('');
        fetchNotices();
      } else {
        alert('Failed to send alert.');
      }
    } catch {
      alert('Error sending alert.');
    } finally {
      setSending(false);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const handleSendAlert = () => {
    if (!message.trim()) {return;}
    if (!confirming) {
      setConfirming(true);
    } else {
      sendAlert();
    }
  };

  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) {return `${diffInSeconds} seconds ago`;}
    if (diffInSeconds < 3600) {return `${Math.floor(diffInSeconds / 60)} minutes ago`;}
    if (diffInSeconds < 86400) {return `${Math.floor(diffInSeconds / 3600)} hours ago`;}
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const dangerButton = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    background: 'rgba(248,113,113,0.15)',
    border: '0.5px solid rgba(248,113,113,0.4)',
    borderRadius: ui.radiusXs,
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    color: ui.red,
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as const;

  return (
    <PageShell spotlight="rgba(248,113,113,0.12)">
      <PageHeader title="Emergency" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* Broadcast card */}
        <div
          style={{
            marginBottom: '40px',
            background: 'rgba(248,113,113,0.06)',
            border: '0.5px solid rgba(248,113,113,0.25)',
            borderRadius: ui.radius,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 40px rgba(248,113,113,0.06)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={ui.red}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '24px', height: '24px' }}
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: ui.text, margin: 0, letterSpacing: '-0.2px' }}>
              Broadcast Emergency Alert
            </h2>
          </div>

          <textarea
            className="hm-input"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(248,113,113,0.25)',
              borderRadius: ui.radiusXs,
              padding: '12px 14px',
              fontSize: '13px',
              color: ui.text,
              outline: 'none',
              resize: 'vertical',
              marginBottom: '16px',
              fontFamily: 'inherit',
            }}
            rows={4}
            placeholder="Type your emergency message here. Be clear and concise..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          {confirming && (
            <div
              style={{
                marginBottom: '16px',
                background: 'rgba(248,113,113,0.12)',
                border: '0.5px solid rgba(248,113,113,0.35)',
                borderRadius: ui.radiusXs,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <p style={{ fontSize: '13px', color: ui.red, margin: 0, fontWeight: 500 }}>
                Are you sure? This cannot be undone.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setConfirming(false)}
                  className="btn-ghost"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    border: '0.5px solid rgba(255,255,255,0.1)',
                    borderRadius: ui.radiusXs,
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: ui.textSoft,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={sendAlert}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: ui.red,
                    border: 'none',
                    borderRadius: ui.radiusXs,
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1a0808',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                >
                  Confirm &amp; Send
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <p style={{ fontSize: '13px', color: 'rgba(248,113,113,0.75)', margin: 0 }}>
              Warning: This will send an immediate notification to all students and staff.
            </p>
            <button
              onClick={handleSendAlert}
              disabled={confirming || sending || !message.trim()}
              style={{
                ...dangerButton,
                opacity: confirming || sending || !message.trim() ? 0.5 : 1,
                cursor: confirming || sending || !message.trim() ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!(confirming || sending || !message.trim()))
                  {e.currentTarget.style.background = 'rgba(248,113,113,0.25)';}
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(248,113,113,0.15)';
              }}
            >
              {sending ? 'Sending...' : confirming ? 'Confirm above ↑' : 'Send Emergency Alert'}
            </button>
          </div>

          {success && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'rgba(74,222,128,0.1)',
                border: '0.5px solid rgba(74,222,128,0.25)',
                borderRadius: ui.radiusXs,
                color: ui.green,
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              ✓ {success}
            </div>
          )}
        </div>

        {/* Recent alerts */}
        <h2 style={{ ...sectionTitle, fontSize: '18px', marginBottom: '20px', letterSpacing: '-0.2px' }}>
          Recent Emergency Alerts
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading ? (
            <LoadingSpinner />
          ) : notices.length === 0 ? (
            <EmptyState message="No emergency alerts sent." icon={<Siren strokeWidth={1.5} />} />
          ) : (
            notices.map((notice) => (
              <div
                key={notice.id}
                className="glass-card"
                style={{
                  background: 'rgba(248,113,113,0.05)',
                  border: '0.5px solid rgba(248,113,113,0.18)',
                  borderRadius: ui.radius,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  padding: '20px 22px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '9999px',
                        background: ui.red,
                        boxShadow: '0 0 8px rgba(248,113,113,0.6)',
                        animation: 'emPulse 1.6s ease-in-out infinite',
                        flexShrink: 0,
                      }}
                    />
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: ui.text, margin: 0 }}>{notice.title}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: ui.textMuted, whiteSpace: 'nowrap' }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ width: '14px', height: '14px' }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {timeAgo(notice.created_at)}
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: ui.textSoft, whiteSpace: 'pre-wrap', margin: 0, marginLeft: '16px', lineHeight: 1.6 }}>
                  {notice.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes emPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </PageShell>
  );
}
