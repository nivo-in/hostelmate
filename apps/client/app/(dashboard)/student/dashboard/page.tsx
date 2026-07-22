'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import dynamic from 'next/dynamic';
import { Reveal } from '@/components/ui/Reveal';
import { TiltCard } from '@/components/ui/TiltCard';
import { CursorGlow } from '@/components/ui/CursorGlow';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { AnimatedProgress } from '@/components/ui/AnimatedProgress';
import { AiAssistant } from '@/components/ui/AiAssistant';
import {
  ClipboardCheck,
  Palmtree,
  Wrench,
  UtensilsCrossed,
  Megaphone,
  PackageSearch,
  Star,
  CreditCard,
  UserCheck,
  ArrowLeftRight,
} from 'lucide-react';

const FaceEnrollment = dynamic(() => import('@/components/face/FaceEnrollment'), {
  ssr: false,
});

const NotificationBell = dynamic(
  () => import('@/components/ui/NotificationBell').then((m) => ({ default: m.NotificationBell })),
  { ssr: false, loading: () => <div style={{ width: 18, height: 18 }} /> }
);

interface StudentStats {
  attendanceRate: number; // overall %
  monthPresent: number;
  monthTotal: number;
  pendingLeaves: number;
  openComplaints: number;
  feesPaid: number;
  feesPending: number;
}

const EMPTY_STATS: StudentStats = {
  attendanceRate: 0,
  monthPresent: 0,
  monthTotal: 0,
  pendingLeaves: 0,
  openComplaints: 0,
  feesPaid: 0,
  feesPending: 0,
};

export default function StudentDashboard() {
  const router = useRouter();
  const { apiGet } = useApi();
  const [firstName, setFirstName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null);
  const [showFaceScanner, setShowFaceScanner] = useState(false);
  const [stats, setStats] = useState<StudentStats>(EMPTY_STATS);
  const scannerRef = useRef<HTMLDivElement>(null);

  const handleToggleFaceScanner = () => {
    const nextState = !showFaceScanner;
    setShowFaceScanner(nextState);
    if (nextState) {
      const scrollToBottom = () => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      };
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 350);
    }
  };

  useEffect(() => {
    const init = async () => {
      // 1. Fast path: hydrate from cache for instant render
      const cached = sessionStorage.getItem('studentDashboardCache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setFirstName(parsed.firstName);
          setStats(parsed.stats);
          setFaceRegistered(parsed.faceRegistered);
          setLoading(false);
        } catch {
          /* ignore bad cache */
        }
      }

      // 2. Fetch fresh data in the background
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setStudentId(user.id);

      const [profileResult, attendanceRes, leavesRes, complaintsRes, paymentsRes, faceResult] =
        await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', user.id).single(),
          apiGet(`/api/v1/attendance/student/${user.id}`).catch(() => null),
          apiGet('/api/v1/leaves/my').catch(() => null),
          apiGet('/api/v1/complaints/my').catch(() => null),
          apiGet('/api/v1/payments/my').catch(() => null),
          supabase.from('face_descriptors').select('student_id').eq('student_id', user.id).single(),
        ]);

      let newFirstName = firstName;
      if (profileResult.data?.full_name) {
        newFirstName = profileResult.data.full_name.split(' ')[0];
        setFirstName(newFirstName);
      }

      const newStats: StudentStats = { ...EMPTY_STATS };

      // Attendance
      if (attendanceRes?.success && Array.isArray(attendanceRes.data)) {
        const records: { date: string; status: string }[] = attendanceRes.data;
        const now = new Date();
        const ym = now.toISOString().slice(0, 7); // YYYY-MM
        const currentDay = now.getDate(); // e.g. 22

        const monthRecords = records.filter((r) => (r.date || '').startsWith(ym));
        const monthPresent = monthRecords.filter((r) => r.status === 'present').length;

        newStats.monthPresent = monthPresent;
        newStats.monthTotal = currentDay;
        newStats.attendanceRate =
          currentDay > 0 ? Math.min(100, Math.round((monthPresent / currentDay) * 100)) : 0;
      }

      // Leaves
      if (leavesRes?.success && Array.isArray(leavesRes.data)) {
        newStats.pendingLeaves = leavesRes.data.filter(
          (l: { status: string }) => l.status === 'pending'
        ).length;
      }

      // Complaints
      if (complaintsRes?.success && Array.isArray(complaintsRes.data)) {
        newStats.openComplaints = complaintsRes.data.filter((c: { status: string }) =>
          ['open', 'pending', 'in_progress'].includes(c.status)
        ).length;
      }

      // Fees
      if (paymentsRes?.success && paymentsRes.data?.totals) {
        newStats.feesPaid = paymentsRes.data.totals.total_paid || 0;
        newStats.feesPending = paymentsRes.data.totals.total_pending || 0;
      }

      setStats(newStats);

      const newFaceRegistered = !!faceResult.data;
      setFaceRegistered(newFaceRegistered);

      sessionStorage.setItem(
        'studentDashboardCache',
        JSON.stringify({ firstName: newFirstName, stats: newStats, faceRegistered: newFaceRegistered })
      );

      setLoading(false);
    };

    init();
  }, []);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };

  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? 'Good morning,'
      : hour >= 12 && hour < 17
        ? 'Good afternoon,'
        : 'Good evening,';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const monthPct = stats.monthTotal
    ? Math.round((stats.monthPresent / stats.monthTotal) * 100)
    : 0;
  const feesTotal = stats.feesPaid + stats.feesPending;
  const feesPaidPct = feesTotal ? Math.round((stats.feesPaid / feesTotal) * 100) : 100;

  return (
    <div style={{ background: '#080810', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Orange spotlight */}
      <div style={{
        position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '900px', height: '600px', pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at center, rgba(251,146,60,0.12) 0%, transparent 70%)',
        animation: 'spotlightFade 1.2s ease-out forwards',
        opacity: 0,
      }} />
      <style>{`
        @keyframes spotlightFade { to { opacity: 1; } }
        @keyframes bellRing {
          0% { transform: rotate(0); } 15% { transform: rotate(15deg); } 30% { transform: rotate(-10deg); }
          45% { transform: rotate(5deg); } 60% { transform: rotate(-3deg); } 75% { transform: rotate(1deg); } 100% { transform: rotate(0); }
        }
        .dash-card { transition: all 0.3s ease; }
        .dash-card:hover {
          background: radial-gradient(circle at top left, rgba(251,146,60,0.07) 0%, rgba(255,255,255,0.015) 100%) !important;
          border-color: rgba(251,146,60,0.16) !important;
        }
        .dash-card .arrow-icon { transition: all 0.3s ease; color: rgba(255,255,255,0.2); transform: translateX(0); }
        .dash-card:hover .arrow-icon { transform: translateX(6px); color: rgba(251,146,60,0.85); }
        .dash-card:hover .icon-tile { border-color: rgba(251,146,60,0.35) !important; background: rgba(251,146,60,0.12) !important; color: #fb923c !important; }
        .signout-btn .signout-arrow { transition: transform 0.2s ease; }
        .signout-btn:hover .signout-arrow { transform: translateX(3px); }
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
            className="signout-btn"
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
              <g className="signout-arrow">
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </g>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <CursorGlow color="rgba(251, 146, 60, 0.12)" size={600} />
        {/* Greeting header */}
        <Reveal>
        <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 suppressHydrationWarning style={{ fontSize: '26px', fontWeight: 500, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>
              {greeting} {loading && !firstName ? 'Student' : firstName || 'Student'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AiAssistant />
            <NotificationBell />
            <div suppressHydrationWarning style={{ fontSize: '12px', color: 'rgba(255,255,255,0.22)' }}>{dateStr}</div>
          </div>
        </div>
        </Reveal>

        {/* Stats row */}
        <Reveal delay={70}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>Attendance Rate</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: '#4ade80' }}><AnimatedNumber value={stats.attendanceRate} />%</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>Pending Leaves</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: '#fbbf24' }}><AnimatedNumber value={stats.pendingLeaves} /></div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>Open Complaints</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: '#f87171' }}><AnimatedNumber value={stats.openComplaints} /></div>
          </div>
        </div>
        </Reveal>

        {/* Progress cards row */}
        <Reveal delay={140}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>Attendance this month</div>
            <div style={{ fontSize: '18px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
              <AnimatedNumber value={stats.monthPresent} /> / <AnimatedNumber value={stats.monthTotal} /> days
            </div>
            <div style={{ marginTop: '12px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <AnimatedProgress value={monthPct} color="#fb923c" />
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>Fees</div>
            <div style={{ fontSize: '18px', fontWeight: 500, color: stats.feesPending > 0 ? '#fbbf24' : 'rgba(255,255,255,0.85)' }}>
              {stats.feesPending > 0 ? <><span style={{ fontFamily: 'sans-serif' }}>₹</span><AnimatedNumber value={stats.feesPending} format /> due</> : feesTotal > 0 ? 'All paid' : 'No dues'}
            </div>
            <div style={{ marginTop: '12px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <AnimatedProgress value={feesPaidPct} color={stats.feesPending > 0 ? '#fb923c' : '#4ade80'} />
            </div>
          </div>
        </div>
        </Reveal>

        {/* Quick Actions Grid */}
        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {[
            { Icon: ClipboardCheck, title: 'Attendance', desc: 'Mark your daily attendance', href: '/student/attendance' },
            { Icon: Palmtree, title: 'Leave Request', desc: 'Apply for leave', href: '/student/leaves' },
            { Icon: Wrench, title: 'Complaints', desc: 'Report a maintenance issue', href: '/student/complaints' },
            { Icon: UtensilsCrossed, title: 'Mess', desc: 'View menu and rate meals', href: '/student/mess' },
            { Icon: Megaphone, title: 'Notices', desc: 'Read announcements', href: '/student/notices' },
            { Icon: PackageSearch, title: 'Lost & Found', desc: 'Report or find items', href: '/student/lost-found' },
            { Icon: Star, title: 'Staff Feedback', desc: 'Rate hostel staff', href: '/student/staff-feedback' },
            { Icon: CreditCard, title: 'Fee Payments', desc: 'Pay hostel and mess fees', href: '/student/payments' },
            { Icon: UserCheck, title: 'Visitors', desc: 'Request visitor passes', href: '/student/visitors' },
            { Icon: ArrowLeftRight, title: 'Room Transfer', desc: 'Request a room change', href: '/student/room-transfer' },
          ].map((item, i) => (
            <Reveal key={i} delay={Math.min(i * 22, 120)} style={{ height: '100%' }}>
            <TiltCard
              onClick={() => router.push(item.href)}
              className="dash-card group"
              accent="#fb923c"
              style={{
                background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '16px',
                padding: '22px 20px', cursor: 'pointer', height: '100%',
                display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div
                  className="icon-tile"
                  style={{
                    width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                    color: 'rgba(255,255,255,0.8)', transition: 'all 0.3s ease'
                  }}
                >
                  <item.Icon size={18} strokeWidth={1.75} />
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
            </TiltCard>
            </Reveal>
          ))}
        </div>

        {/* Face Attendance Security section */}
        {faceRegistered !== null && (
          <Reveal>
          <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)', margin: 0 }}>Face Attendance</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                  {faceRegistered
                    ? 'Face data registered — mark attendance instantly with a face scan'
                    : 'No face registered — set one up for fast, secure attendance'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {faceRegistered && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#fb923c', fontWeight: 500 }}>
                    <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Active
                  </span>
                )}
                <button
                  onClick={handleToggleFaceScanner}
                  style={{ minWidth: '110px', display: 'flex', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.borderColor = 'rgba(251,146,60,0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  {showFaceScanner ? 'Close Scanner' : faceRegistered ? 'Update Face' : 'Set up Face'}
                </button>
              </div>
            </div>

            {/* Inline Face Scanner */}
            {showFaceScanner && (
              <div ref={scannerRef} style={{ marginTop: '20px', borderRadius: '16px', overflow: 'hidden', background: '#0a0a0c', border: '0.5px solid rgba(255,255,255,0.1)', padding: '0px' }}>
                <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>Loading face scanner…</div>}>
                  <FaceEnrollment
                    subjectId={studentId}
                    role="student"
                    onSuccess={() => {
                      setShowFaceScanner(false);
                      setFaceRegistered(true);
                    }}
                    onCancel={() => setShowFaceScanner(false)}
                  />
                </Suspense>
              </div>
            )}
          </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
