'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { container } from '@/lib/ui';

const ORANGE = '#fb923c';

interface Visitor {
  id: string;
  visitor_name: string;
  relationship: string;
  purpose: string;
  expected_visit_date: string;
  status: string;
  warden_notes?: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#fbbf24' },
  approved: { label: 'Approved', color: '#4ade80' },
  rejected: { label: 'Rejected', color: '#f87171' },
  checked_in: { label: 'Checked In', color: '#60a5fa' },
  checked_out: { label: 'Checked Out', color: '#60a5fa' },
};

export default function StudentVisitors() {
  const router = useRouter();
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [purpose, setPurpose] = useState('');
  const [expectedDate, setExpectedDate] = useState('');

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { apiGet, apiPost } = useApi();
  const supabase = createClient();

  const fetchVisitors = async () => {
    try {
      const res = await apiGet('/api/v1/visitors/my');
      if (res.success) setVisitors(res.data || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim() || !visitorPhone.trim() || !purpose.trim() || !expectedDate) {
      return setError('All fields are required');
    }

    try {
      const res = await apiPost('/api/v1/visitors', {
        visitor_name: visitorName,
        visitor_phone: visitorPhone,
        purpose,
        relationship,
        expected_visit_date: expectedDate,
      });

      if (res.success) {
        setVisitorName('');
        setVisitorPhone('');
        setPurpose('');
        setExpectedDate('');
        setRelationship('parent');
        setError('');
        setSuccess('Visitor request submitted. Awaiting warden approval.');
        setTimeout(() => setSuccess(''), 5000);
        fetchVisitors();
      } else {
        setError(res.error || 'Failed to submit request');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to submit request');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_STYLES[status];
    if (!s) return null;
    return (
      <span
        style={{
          display: 'inline-block',
          fontSize: '11px',
          fontWeight: 600,
          color: s.color,
          background: `${s.color}1c`,
          border: `0.5px solid ${s.color}40`,
          borderRadius: '999px',
          padding: '3px 10px',
        }}
      >
        {s.label}
      </span>
    );
  };

  const today = new Date().toISOString().split('T')[0];

  const onInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(251,146,60,0.5)';
  };
  const onInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
  };

  return (
    <PageShell spotlight="rgba(251,146,60,0.12)">
      <PageHeader title="Visitors" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* ── REQUEST NEW VISITOR ── */}
        <div style={{ ...panelStyle, padding: '24px', marginBottom: '32px' }} className="glass-card">
          <h2 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: '18px' }}>
            Request New Visitor
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '420px' }}>
            <div>
              <label style={labelStyle}>Visitor Name</label>
              <input
                type="text"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                required
                minLength={2}
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input
                type="tel"
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                required
                minLength={10}
                maxLength={15}
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              />
            </div>
            <div>
              <label style={labelStyle}>Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                style={{ ...inputStyle, colorScheme: 'dark' }}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              >
                <option value="parent">Parent</option>
                <option value="sibling">Sibling</option>
                <option value="relative">Relative</option>
                <option value="friend">Friend</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Purpose of Visit</label>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
                minLength={10}
                style={{ ...inputStyle, resize: 'vertical' }}
                rows={3}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              ></textarea>
            </div>
            <div>
              <label style={labelStyle}>Expected Visit Date</label>
              <input
                type="date"
                min={today}
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                required
                style={{ ...inputStyle, colorScheme: 'dark' }}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              />
            </div>

            {error && <p className="text-red-500" style={{ fontSize: '12px' }}>{error}</p>}
            {success && <p style={{ fontSize: '12px', color: '#4ade80' }}>{success}</p>}

            <button
              type="submit"
              style={{
                alignSelf: 'flex-start',
                background: ORANGE,
                color: '#1a0f04',
                borderRadius: '10px',
                border: 'none',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '4px',
                transition: 'filter 0.2s',
              }}
              className="btn-primary"
            >
              Submit Request
            </button>
          </form>
        </div>

        {/* ── MY VISITOR REQUESTS ── */}
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: '14px' }}>
            My Visitor Requests
          </h2>
          {visitors.length === 0 ? (
            <div style={{ ...panelStyle, padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
              No visitor requests yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visitors.map((v) => (
                <div key={v.id} style={{ ...panelStyle, padding: '20px' }} className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', textTransform: 'capitalize' }}>
                        {v.visitor_name}
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                        {v.relationship}
                      </span>
                    </div>
                    {getStatusBadge(v.status)}
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>{v.purpose}</p>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Date: {v.expected_visit_date}</div>

                  {v.status === 'approved' && (
                    <div style={{ marginTop: '14px', fontSize: '12px', fontWeight: 500, color: '#4ade80' }}>Approved ✓</div>
                  )}
                  {v.status === 'rejected' && v.warden_notes && (
                    <div style={{ marginTop: '14px', fontSize: '12px', color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', padding: '12px', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>Warden Notes:</span>
                      {v.warden_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'rgba(255,255,255,0.5)',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '13px',
  color: 'rgba(255,255,255,0.85)',
  outline: 'none',
};
