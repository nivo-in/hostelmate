'use client';
import { Star } from 'lucide-react';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { container } from '@/lib/ui';

const ORANGE = '#fb923c';
const STAR_EMPTY = 'rgba(255,255,255,0.2)';

type StaffMember = {
  id: string;
  name: string;
  role: string;
  average_rating?: number;
};

export default function StaffFeedbackPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchStaff = async () => {
    try {
      const res = await apiGet('/api/v1/staff-feedback');
      if (res.success) setStaffList(res.data);
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSubmit = async (staff_id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (rating === 0) {
      setErrorMsg('Please select a rating');
      return;
    }

    try {
      const res = await apiPost('/api/v1/staff-feedback', { staff_id, rating, comment });
      if (res.success) {
        setSuccessMsg('Feedback submitted ✓');
        setSelectedStaff(null);
        setRating(0);
        setComment('');
        fetchStaff();
      } else {
        setErrorMsg(res.error || 'Failed to submit feedback');
      }
    } catch (e: unknown) {
      setErrorMsg((e as Error).message || 'An error occurred');
    }
  };

  const renderStars = (ratingValue: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <span key={i} style={{ color: i < ratingValue ? ORANGE : STAR_EMPTY }}><Star size={16} strokeWidth={1.5} /></span>
    ));
  };

  return (
    <PageShell spotlight="rgba(251,146,60,0.12)">
      <PageHeader title="Staff Feedback" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {successMsg && (
          <div style={successBox}>{successMsg}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {staffList.length === 0 ? (
            <div style={{ ...panelStyle, padding: '40px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
              No staff members available
            </div>
          ) : (
            staffList.map((staff) => (
              <div key={staff.id} className="glass-card" style={{ ...panelStyle, padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      {staff.name} <Badge>{staff.role}</Badge>
                    </h3>
                    <div style={{ fontSize: '14px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {renderStars(Math.round(staff.average_rating || 0))}
                      <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '6px', fontSize: '12px' }}>
                        ({staff.average_rating || 'Unrated'})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaff(staff.id);
                      setRating(0);
                      setHoverRating(0);
                      setComment('');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    style={{ background: ORANGE, color: '#1a0f04', fontWeight: 600, borderRadius: '10px', padding: '9px 16px', fontSize: '13px', border: 'none', cursor: 'pointer' }}
                  >
                    Rate
                  </button>
                </div>

                {selectedStaff === staff.id && (
                  <div style={{ marginTop: '16px', borderTop: '0.5px solid rgba(255,255,255,0.07)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', margin: 0 }}>Your Rating</h4>
                      <button
                        type="button"
                        onClick={() => setSelectedStaff(null)}
                        style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', fontSize: '24px', marginBottom: '16px', cursor: 'pointer' }}>
                      {Array.from({ length: 5 }).map((_, i) => {
                        const active = i < (hoverRating || rating);
                        return (
                          <span
                            key={i}
                            onClick={() => setRating(i + 1)}
                            onMouseEnter={() => setHoverRating(i + 1)}
                            onMouseLeave={() => setHoverRating(0)}
                            style={{ color: active ? (hoverRating ? '#fdba74' : ORANGE) : STAR_EMPTY, transition: 'color 0.15s' }}
                          ><Star size={16} strokeWidth={1.5} /></span>
                        );
                      })}
                    </div>

                    <textarea
                      placeholder="Share your feedback..."
                      className="hm-input"
                      style={{ ...inputStyle, marginBottom: '12px', resize: 'vertical' }}
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(251,146,60,0.5)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                    />

                    {errorMsg && <p className="text-red-500" style={{ fontSize: '12px', marginBottom: '12px' }}>{errorMsg}</p>}

                    <button
                      type="submit"
                      onClick={() => handleSubmit(staff.id)}
                      style={{ background: ORANGE, color: '#1a0f04', fontWeight: 600, borderRadius: '10px', padding: '9px 16px', fontSize: '13px', border: 'none', cursor: 'pointer', width: '100%' }}
                    >
                      Submit Feedback
                    </button>
                  </div>
                )}
              </div>
            ))
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '13px',
  color: 'rgba(255,255,255,0.85)',
  outline: 'none',
  colorScheme: 'dark',
};

const successBox: React.CSSProperties = {
  marginBottom: '16px',
  background: 'rgba(74,222,128,0.1)',
  border: '0.5px solid rgba(74,222,128,0.25)',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
  fontWeight: 500,
  color: '#4ade80',
};
