'use client';

import { Palmtree, Megaphone, Phone, CreditCard, Check, X, Plane, Calendar as CalendarIcon } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

const NotificationBell = dynamic(
  () => import('@/components/ui/NotificationBell').then((m) => ({ default: m.NotificationBell })),
  { ssr: false, loading: () => <div style={{ width: 18, height: 18 }} /> }
);
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { Reveal } from '@/components/ui/Reveal';
import { TiltCard } from '@/components/ui/TiltCard';

interface StudentInfo {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  roll_number: string | null;
  room_number: string | null;
  block_name: string | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  scan_time: string | null;
}

interface ParentStudentData {
  student: StudentInfo;
  today_attendance: AttendanceRecord | null;
  month_attendance: AttendanceRecord[];
  relation: string;
}

export default function ParentDashboard() {
  const router = useRouter();
  const { apiGet } = useApi();
  const supabase = createClient();
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(true);
  const [wardData, setWardData] = useState<ParentStudentData | null>(null);
  const [wardError, setWardError] = useState<string | null>(null);
  const studentIdRef = useRef<string | null>(null);

  const fetchWardData = useCallback(async () => {
    try {
      const res = await apiGet('/api/v1/parent/my-student');
      if (res.success && res.data) {
        setWardData(res.data);
        studentIdRef.current = res.data.student.id;
        setWardError(null);
      } else {
        setWardError(res.error || 'No linked student found');
      }
    } catch {
      setWardError('Failed to load ward information');
    }
  }, [apiGet]);

  const init = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      if (profileData?.full_name) {
        setFirstName(profileData.full_name.split(' ')[0]);
      }

      await fetchWardData();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchWardData]);

  useEffect(() => {
    init();
  }, [init]);

  useSocket({
    'attendance:marked': (payload: unknown) => {
      const data = payload as { student_id?: string };
      if (!studentIdRef.current || data?.student_id === studentIdRef.current) {
        fetchWardData();
      }
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Good morning,' : hour >= 12 && hour < 17 ? 'Good afternoon,' : 'Good evening,';

  const studentFirstName = wardData?.student?.full_name
    ? wardData.student.full_name.split(' ')[0]
    : null;
  const parentDisplayName = studentFirstName
    ? `${studentFirstName}'s Parent`
    : loading
    ? 'Parent'
    : firstName
    ? `${firstName}'s Parent`
    : 'Parent';

  const renderTodayStatus = () => {
    if (!wardData) {return null;}
    const { today_attendance } = wardData;

    if (!today_attendance) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9ca3af' }} />
          Attendance not marked today
        </div>
      );
    }

    if (today_attendance.status === 'present') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(74,222,128,0.1)', border: '0.5px solid rgba(74,222,128,0.25)', fontSize: '12px', color: '#4ade80', fontWeight: 500 }}>
          <Check size={14} strokeWidth={2.5} />
          Present Today {today_attendance.scan_time ? `(${new Date(today_attendance.scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
        </div>
      );
    }

    if (today_attendance.status === 'absent') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.25)', fontSize: '12px', color: '#f87171', fontWeight: 500 }}>
          <X size={14} strokeWidth={2.5} />
          Absent Today
        </div>
      );
    }

    if (today_attendance.status === 'leave') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(251,146,60,0.1)', border: '0.5px solid rgba(251,146,60,0.25)', fontSize: '12px', color: '#fb923c', fontWeight: 500 }}>
          <Plane size={14} strokeWidth={2} />
          On Leave
        </div>
      );
    }
  };

  const renderCalendar = () => {
    if (!wardData) {return null;}
    const { month_attendance } = wardData;
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const todayDate = today.getDate();

    const attendanceMap = new Map<string, string>();
    month_attendance.forEach((r) => {
      attendanceMap.set(r.date, r.status);
    });

    const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const blanks = Array.from({ length: firstDay });
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getDayStyle = (day: number) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const status = attendanceMap.get(dateStr);
      if (status === 'present') {
        return { bg: 'rgba(74,222,128,0.2)', color: '#4ade80', border: 'rgba(74,222,128,0.4)' };
      }
      if (status === 'absent') {
        return { bg: 'rgba(248,113,113,0.2)', color: '#f87171', border: 'rgba(248,113,113,0.4)' };
      }
      if (status === 'leave') {
        return { bg: 'rgba(251,146,60,0.2)', color: '#fb923c', border: 'rgba(251,146,60,0.4)' };
      }
      return { bg: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.25)', border: 'transparent' };
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CalendarIcon size={12} color="#60a5fa" />
            {today.toLocaleString('default', { month: 'short' })} Attendance
          </span>
          <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80' }} /> Present</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f87171' }} /> Absent</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fb923c' }} /> Leave</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', width: '100%' }}>
          {dayHeaders.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
              {d}
            </div>
          ))}
          {blanks.map((_, i) => (
            <div key={`b-${i}`} />
          ))}
          {days.map((day) => {
            const st = getDayStyle(day);
            const isToday = day === todayDate;
            return (
              <div
                key={day}
                style={{
                  height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', borderRadius: '4px', fontWeight: 500,
                  background: st.bg, color: st.color, border: `0.5px solid ${st.border}`,
                  boxShadow: isToday ? '0 0 0 1px #60a5fa' : 'none'
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: '#080810', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '900px', height: '600px', pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at center, rgba(96,165,250,0.08) 0%, transparent 70%)',
        animation: 'spotlightFade 1.2s ease-out forwards',
        opacity: 0,
      }} />
      <style>{`
        @keyframes spotlightFade { to { opacity: 1; } }
        .dash-card { transition: all 0.3s ease; }
        .dash-card:hover {
          background: radial-gradient(circle at top left, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%) !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .dash-card .arrow-icon { transition: all 0.3s ease; color: rgba(255,255,255,0.2); transform: translateX(0); }
        .dash-card:hover .arrow-icon { transform: translateX(6px); color: rgba(255,255,255,0.6); }
        .dash-card:hover .icon-tile { border-color: rgba(255,255,255,0.3) !important; background: rgba(255,255,255,0.15) !important; color: #ffffff !important; }
        .signout-btn .signout-arrow { transition: transform 0.2s ease; }
        .signout-btn:hover .signout-arrow { transform: translateX(3px); }
      `}</style>

      {/* Top bar */}
      <div style={{ padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>HostelMate</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>BY NIVO</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <NotificationBell />
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

      <div style={{ padding: '16px 32px 24px', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <Reveal>
        <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 suppressHydrationWarning style={{ fontSize: '24px', fontWeight: 500, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>
              {greeting} {parentDisplayName}
            </h1>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>Tracking your ward</div>
          </div>
        </div>
        </Reveal>

        {/* Embedded Ward Tracking Panel (3-Column Full-Width Design) */}
        <Reveal delay={50}>
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '20px 24px', marginBottom: '16px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
        }}>
          {wardError ? (
            <div style={{ fontSize: '13px', color: '#f87171', textAlign: 'center', padding: '8px' }}>{wardError}</div>
          ) : !wardData ? (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '8px' }}>Loading ward details…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '24px', alignItems: 'center' }}>
              {/* Column 1: Ward Profile & Today Status */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '12px',
                    background: 'rgba(96,165,250,0.12)', border: '0.5px solid rgba(96,165,250,0.3)',
                    color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', fontWeight: 600, flexShrink: 0
                  }}>
                    {wardData.student.full_name?.[0] ?? 'W'}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 500, color: '#ffffff', margin: 0 }}>
                      {wardData.student.full_name}
                    </h2>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0 0' }}>
                      {wardData.student.roll_number && <span style={{ marginRight: '8px' }}>Roll: {wardData.student.roll_number}</span>}
                      {wardData.student.room_number && (
                        <span>
                          Room {wardData.student.room_number} {wardData.student.block_name ? `(${wardData.student.block_name})` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {renderTodayStatus()}
              </div>

              {/* Column 2: Attendance Metrics & Progress Bar */}
              <div style={{ borderLeft: '0.5px solid rgba(255,255,255,0.08)', borderRight: '0.5px solid rgba(255,255,255,0.08)', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>Monthly Rate</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#4ade80' }}>
                    {Math.min(100, Math.round(((wardData.month_attendance.filter((r) => r.status === 'present').length) / Math.max(1, Math.min(new Date().getDate(), new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()))) * 100))}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
                  <div style={{
                    width: `${Math.min(100, Math.round(((wardData.month_attendance.filter((r) => r.status === 'present').length) / Math.max(1, Math.min(new Date().getDate(), new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()))) * 100))}%`,
                    background: '#4ade80', transition: 'width 0.5s ease'
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                  <span>Present: <strong style={{ color: '#4ade80' }}>{wardData.month_attendance.filter((r) => r.status === 'present').length}d</strong></span>
                  <span>Absent: <strong style={{ color: '#f87171' }}>{wardData.month_attendance.filter((r) => r.status === 'absent').length}d</strong></span>
                  <span>Leave: <strong style={{ color: '#fb923c' }}>{wardData.month_attendance.filter((r) => r.status === 'leave').length}d</strong></span>
                </div>
              </div>

              {/* Column 3: Calendar Grid */}
              <div>
                {renderCalendar()}
              </div>
            </div>
          )}
        </div>
        </Reveal>

        {/* Quick Actions Grid (2x2) */}
        <Reveal delay={100}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {[
            { icon: <Palmtree size={18} />, title: 'Leave Status', desc: "View ward's leave requests", href: '/parent/leaves' },
            { icon: <Megaphone size={18} />, title: 'Notices', desc: 'Read hostel announcements', href: '/parent/notices' },
            { icon: <Phone size={18} />, title: 'Contact Warden', desc: 'Get in touch with hostel warden', href: '/parent/contact' },
            { icon: <CreditCard size={18} />, title: 'Fee Payments', desc: "Pay ward's hostel fees", href: '/parent/payments' },
          ].map((item, i) => (
            <TiltCard
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
                <div
                  className="icon-tile"
                  style={{
                    width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(96,165,250,0.1)', border: '0.5px solid rgba(96,165,250,0.25)', borderRadius: '10px',
                    color: '#60a5fa', transition: 'all 0.3s ease'
                  }}
                >
                  {item.icon}
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
          ))}
        </div>
        </Reveal>
      </div>
    </div>
  );
}
