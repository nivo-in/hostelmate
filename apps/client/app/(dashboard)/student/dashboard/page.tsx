'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(true);

  const init = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const [profileResult] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      ]);

      if (profileResult.data?.full_name) {
        setFirstName(profileResult.data.full_name.split(' ')[0]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Good morning,' : hour >= 12 && hour < 17 ? 'Good afternoon,' : 'Good evening,';

  return (
    <div style={{ background: '#080810', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '900px', height: '600px', pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at center, rgba(74,222,128,0.08) 0%, transparent 70%)',
        animation: 'spotlightFade 1.2s ease-out forwards',
        opacity: 0,
      }} />
      <style>{`
        @keyframes spotlightFade {
          to { opacity: 1; }
        }
        .dash-card { transition: all 0.3s ease; }
        .dash-card:hover {
          background: radial-gradient(circle at top left, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%) !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .dash-card .arrow-icon { transition: all 0.3s ease; color: rgba(255,255,255,0.2); transform: translateX(0); }
        .dash-card:hover .arrow-icon { transform: translateX(6px); color: rgba(255,255,255,0.6); }
      `}</style>

      {/* Top bar */}
      <div style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>HostelMate</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>BY NIVO</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={handleSignOut} 
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.35)', 
              background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '8px', 
              padding: '6px 10px', cursor: 'pointer', transition: 'color 0.2s' 
            }} 
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'} 
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
          >
            Sign out
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '32px' }}>
          <div suppressHydrationWarning style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{greeting}</div>
          <h1 style={{ fontSize: '26px', fontWeight: 500, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>{loading ? 'Student' : firstName}</h1>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.28)', marginTop: '4px' }}>Welcome to HostelMate</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {[
            { emoji:'📋', title:'Attendance', desc:'Mark your daily attendance', href:'/student/attendance' },
            { emoji:'🌴', title:'Leave Request', desc:'Apply for leave', href:'/student/leaves' },
            { emoji:'🔧', title:'Complaints', desc:'Report a maintenance issue', href:'/student/complaints' },
            { emoji:'🍽', title:'Mess', desc:'View menu and rate meals', href:'/student/mess' },
            { emoji:'📢', title:'Notices', desc:'Read announcements', href:'/student/notices' },
            { emoji:'🔍', title:'Lost & Found', desc:'Report or find items', href:'/student/lost-found' },
            { emoji:'⭐', title:'Staff Feedback', desc:'Rate hostel staff', href:'/student/staff-feedback' },
            { emoji:'💳', title:'Fee Payments', desc:'Pay hostel and mess fees', href:'/student/payments' },
            { emoji:'👥', title:'Visitors', desc:'Request visitor passes', href:'/student/visitors' },
            { emoji:'🔄', title:'Room Transfer', desc:'Request a room change', href:'/student/room-transfer' },
          ].map((item, i) => (
            <div
              key={i}
              onClick={() => router.push(item.href)}
              style={{
                background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '16px',
                padding: '22px 20px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', overflow: 'hidden',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
              }}
              className="dash-card group"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '10px', fontSize: '18px'
                }}>
                  {item.emoji}
                </div>
                <div className="flex mt-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] arrow-icon">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.82)', margin: '0 0 4px 0' }}>{item.title}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.32)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
