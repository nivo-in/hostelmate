'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import dynamic from 'next/dynamic';

const WardenFaceRegistration = dynamic(() => import('@/components/face/WardenFaceRegistration'), {
  ssr: false,
});

interface StatsData {
  attendanceToday: number;
  pendingLeaves: number;
  openComplaints: number;
  activeNotices: number;
}

interface StatsApiResponse {
  success: boolean;
  data: {
    attendance?: { today_percentage?: number };
    leaves?: { pending_count?: number };
    complaints?: { open_count?: number };
    notices?: { total_active?: number };
  };
}

export default function WardenDashboard() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [wardenId, setWardenId] = useState('');
  const [showFaceRegister, setShowFaceRegister] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData>({
    attendanceToday: 0,
    pendingLeaves: 0,
    openComplaints: 0,
    activeNotices: 0,
  });

  const { apiGet } = useApi();

  useEffect(() => {
    const init = async () => {
      // 1. Fast path: load from cache to make it instant
      const cached = sessionStorage.getItem('wardenDashboardCache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setFirstName(parsed.firstName);
          setStats(parsed.stats);
          setFaceRegistered(parsed.faceRegistered);
          setWardenId(parsed.wardenId);
          setLoading(false); // Instant render
        } catch (e) {
          console.error('Failed to parse cache', e);
        }
      }

      // 2. Fetch fresh data in the background
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      if (!cached) setWardenId(user.id);

      // All fetches run in parallel
      const [profileResult, statsResult, faceResult] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        (apiGet('/api/v1/stats/dashboard') as Promise<StatsApiResponse>).catch(() => null),
        supabase
          .from('warden_face_descriptors')
          .select('warden_id')
          .eq('warden_id', user.id)
          .single(),
      ]);

      let newFirstName = firstName;
      if (profileResult.data?.full_name) {
        newFirstName = profileResult.data.full_name.split(' ')[0];
        setFirstName(newFirstName);
      }

      let newStats = stats;
      if (statsResult?.success && statsResult.data) {
        newStats = {
          attendanceToday: statsResult.data.attendance?.today_percentage ?? 0,
          pendingLeaves: statsResult.data.leaves?.pending_count ?? 0,
          openComplaints: statsResult.data.complaints?.open_count ?? 0,
          activeNotices: statsResult.data.notices?.total_active ?? 0,
        };
        setStats(newStats);
      }

      const newFaceRegistered = !!faceResult.data;
      setFaceRegistered(newFaceRegistered);
      
      // Update cache
      sessionStorage.setItem('wardenDashboardCache', JSON.stringify({
        firstName: newFirstName,
        stats: newStats,
        faceRegistered: newFaceRegistered,
        wardenId: user.id
      }));
      
      setLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ background: '#080810', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Spotlight */}
      <div style={{
        position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '900px', height: '600px', pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at center, rgba(124,92,252,0.1) 0%, transparent 70%)',
        animation: 'spotlightFade 1.2s ease-out forwards',
        opacity: 0,
      }} />
      <style>{`
        @keyframes spotlightFade {
          to { opacity: 1; }
        }
      `}</style>
      
      {/* Top bar */}
      <div style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>HostelMate</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>BY NIVO</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={handleSignOut} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>Sign Out</button>
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.3px', margin: 0 }}>Warden dashboard</h1>
          <div suppressHydrationWarning style={{ fontSize: '12px', color: 'rgba(255,255,255,0.22)' }}>{dateStr}</div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>Attendance Today</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: '#4ade80' }}>{stats.attendanceToday}%</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>Pending Leaves</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: '#fbbf24' }}>{stats.pendingLeaves}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>Open Complaints</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: '#f87171' }}>{stats.openComplaints}</div>
          </div>
        </div>

        {/* Progress cards row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>Mess rating</div>
            <div style={{ fontSize: '18px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>4.2 / 5.0</div>
            <div style={{ marginTop: '12px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '84%', height: '100%', background: '#4ade80' }} />
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>Curfew violations</div>
            <div style={{ fontSize: '18px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>12 Active</div>
            <div style={{ marginTop: '12px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '24%', height: '100%', background: '#f87171' }} />
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {[
            { emoji:'📋', title:'Attendance', desc:'View and manage attendance', href:'/warden/attendance' },
            { emoji:'✅', title:'Leave Management', desc:'Approve or reject leaves', href:'/warden/leaves' },
            { emoji:'🔧', title:'Complaints', desc:'Track and resolve issues', href:'/warden/complaints' },
            { emoji:'🍽️', title:'Mess Management', desc:'Update weekly menu', href:'/warden/mess' },
            { emoji:'📢', title:'Notices', desc:'Post announcements', href:'/warden/notices' },
            { emoji:'👥', title:'Staff Directory', desc:'Manage staff contacts', href:'/warden/staff' },
            { emoji:'🔍', title:'Lost & Found', desc:'Oversee item directory', href:'/warden/lost-found' },
            { emoji:'🚨', title:'Emergency', desc:'Send emergency alerts', href:'/warden/emergency' },
            { emoji:'🏠', title:'Room Allocation', desc:'Manage rooms and assignments', href:'/warden/rooms' },
            { emoji:'🌙', title:'Curfew Management', desc:'Track and notify curfew violations', href:'/warden/curfew' },
            { emoji:'📋', title:'Audit Log', desc:'View all system activity', href:'/warden/audit' },
            { emoji:'🚪', title:'Visitor Management', desc:'Manage guest check-ins', href:'/warden/visitors' },
            { emoji:'💰', title:'Fee Management', desc:'Collect and track hostel fees', href:'/warden/payments' },
          ].map((item, i) => (
            <div
              key={i}
              onClick={() => router.push(item.href)}
              style={{
                background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '16px',
                padding: '22px 20px', cursor: 'pointer', transition: 'background 0.2s, border-color 0.2s',
                display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', overflow: 'hidden'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.055)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
              className="group"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '20px' }}>{item.emoji}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px', color: 'rgba(255,255,255,0.2)', transition: 'color 0.2s' }} className="group-hover:!text-white/60">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.82)', margin: '0 0 4px 0' }}>{item.title}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.32)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Warden Face Registration section at the bottom */}
        {!loading && (
          <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)', margin: 0 }}>Login Face Security</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                  {faceRegistered ? 'Face data registered — verified on each login' : 'No face registered — add one to secure your login'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {faceRegistered && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#4ade80', fontWeight: 500 }}>
                    <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Active
                  </span>
                )}
                <button
                  id="warden-manage-face-btn"
                  onClick={() => setShowFaceRegister(!showFaceRegister)}
                  style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                >
                  {showFaceRegister ? 'Cancel' : faceRegistered ? 'Update Face' : 'Register Face'}
                </button>
              </div>
            </div>

            {showFaceRegister && wardenId && (
              <div style={{ border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '14px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', marginTop: '16px' }}>
                <WardenFaceRegistration
                  wardenId={wardenId}
                  onSuccess={() => {
                    setShowFaceRegister(false);
                    setFaceRegistered(true);
                  }}
                  onSkip={() => setShowFaceRegister(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
