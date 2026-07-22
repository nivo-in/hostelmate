'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/ui/Reveal';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { Profile, LeaveRequest } from '@/types';
import { Palmtree, Calendar, AlertCircle } from 'lucide-react';

export default function ParentLeaves() {
  const router = useRouter();
  const supabase = createClient();
  const { apiGet } = useApi();
  const { profile, loading: profileLoading } = useProfile();

  const [student, setStudent] = useState<Profile | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaves = async () => {
      if (!profile?.id) {return;}

      const { data: parentData } = await supabase
        .from('parents')
        .select('student_id')
        .eq('profile_id', profile.id)
        .single();

      if (parentData?.student_id) {
        const { data: studentData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', parentData.student_id)
          .single();

        setStudent(studentData);

        try {
          const res = await apiGet(`/api/v1/leaves/my?studentId=${parentData.student_id}`);
          if (res.success) {
            setLeaves(res.data);
          }
        } catch {
          // Silently fail
        }
      }
      setLoading(false);
    };

    if (!profileLoading) {
      fetchLeaves();
    }
  }, [profile, profileLoading, supabase, apiGet]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'approved') {
      return (
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '0.5px solid rgba(74,222,128,0.25)', borderRadius: '6px', padding: '3px 8px', letterSpacing: '0.3px' }}>
          APPROVED
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.25)', borderRadius: '6px', padding: '3px 8px', letterSpacing: '0.3px' }}>
          REJECTED
        </span>
      );
    }
    return (
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#fb923c', background: 'rgba(251,146,60,0.1)', border: '0.5px solid rgba(251,146,60,0.25)', borderRadius: '6px', padding: '3px 8px', letterSpacing: '0.3px' }}>
        PENDING
      </span>
    );
  };

  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

  const filteredLeaves = leaves.filter((l) => {
    if (filter === 'all') {return true;}
    return l.status.toLowerCase() === filter;
  });

  return (
    <PageShell spotlight="rgba(96,165,250,0.12)">
      <PageHeader title="Leave Requests" showBack onSignOut={handleSignOut} />

      <div style={{ padding: '24px 32px', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <Reveal>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Palmtree size={18} color="#60a5fa" />
                <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff', margin: 0 }}>
                  {student ? `${student.full_name}'s Leave Requests` : 'Leave Requests'}
                </h2>
              </div>

              {/* Status Filter Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {(['all', 'approved', 'pending', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilter(st)}
                    style={{
                      padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                      border: '0.5px solid', cursor: 'pointer', textTransform: 'capitalize',
                      background: filter === st ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.04)',
                      borderColor: filter === st ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.08)',
                      color: filter === st ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                Loading leave records...
              </div>
            ) : filteredLeaves.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'rgba(255,255,255,0.3)' }}>
                  <AlertCircle size={20} />
                </div>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500 }}>No {filter !== 'all' ? filter : ''} leave requests found</p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>No leave applications match the selected filter.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                      <th style={thStyle}>Duration</th>
                      <th style={thStyle}>Reason</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Applied On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaves.map((l) => (
                      <tr key={l.id} className="row-hover" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)', transition: 'background 0.15s ease' }}>
                        <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.85)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                            <Calendar size={13} color="rgba(255,255,255,0.4)" />
                            {l.start_date} <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span> {l.end_date}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.7)', maxWidth: '240px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {l.reason}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {getStatusBadge(l.status)}
                        </td>
                        <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.4)' }}>
                          {new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </PageShell>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 20px',
  fontSize: '11px',
  fontWeight: 500,
  color: 'rgba(255,255,255,0.4)',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 20px',
};
