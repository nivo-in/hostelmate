/**
 * @file apps/client/app/(dashboard)/student/attendance/page.tsx
 * Student portal attendance dashboard subpage rendering status and actions.
 */

'use client';

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useProfile } from '@/hooks/useProfile';
import { useRouter } from 'next/navigation';
import { container } from '@/lib/ui';
import { Lock, Smartphone } from 'lucide-react';

// Lazy-load face components so face-api.js is not bundled in the initial chunk
const FaceEnrollment = lazy(() => import('@/components/face/FaceEnrollment'));
const StudentFaceVerification = lazy(() => import('@/components/face/StudentFaceVerification'));

const ORANGE = '#fb923c';
const ORANGE_SOFT = 'rgba(251,146,60,0.12)';
const ORANGE_BORDER = 'rgba(251,146,60,0.35)';

interface AttendanceRecord {
  id?: string;
  date: string;
  status: string;
  scan_time: string | null;
}

type AttendanceMode = 'choose' | 'face' | 'qr' | 'success';

type AttendanceView =
  | 'checking-face' // checking if face is registered
  | 'face-registration' // student has no face registered
  | 'main'; // attendance mode selector + history

// SuccessAnimation: uses a ref for onDone so the effect fires ONCE (empty deps)
function SuccessAnimation({ onDone }: { onDone: () => void }) {
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const timer = setTimeout(() => onDoneRef.current(), 2500);
    return () => clearTimeout(timer);
  }, []); // ← empty deps: timer set ONCE, never reset

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer"
      style={{ background: 'rgba(8,8,16,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onDone}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={ORANGE}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="283"
              strokeDashoffset="283"
              style={{
                animation: 'drawCircle 0.6s ease-out forwards',
                transformOrigin: 'center',
                transform: 'rotate(-90deg)',
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-10 h-10"
              fill="none"
              stroke={ORANGE}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: 'fadeInScale 0.3s ease-out 0.5s both' }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <div style={{ animation: 'fadeInUp 0.4s ease-out 0.4s both' }}>
          <p className="text-xl font-medium tracking-tight text-center" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Attendance Marked
          </p>
          <p className="text-sm text-center mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>You&apos;re all set for today</p>
          <p className="text-xs text-center mt-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Click anywhere to continue</p>
        </div>

        <style>{`
          @keyframes drawCircle { to { stroke-dashoffset: 0; } }
          @keyframes fadeInScale { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  present: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)' },
  absent: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
  default: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' },
};

export default function StudentAttendance() {
  const router = useRouter();
  const [view, setView] = useState<AttendanceView>('checking-face');
  const [mode, setMode] = useState<AttendanceMode>('choose');
  const [faceError, setFaceError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [showReRegister, setShowReRegister] = useState(false);
  const [markingAttendance, setMarkingAttendance] = useState(false);

  const { profile } = useProfile();
  const { apiGet, apiPost } = useApi();
  const supabase = createClient();

  const fetchHistory = useCallback(async () => {
    if (!profile?.id) {return;}
    try {
      const ym = new Date().toISOString().slice(0, 7);
      const res = await apiGet(`/api/v1/attendance/student/${profile.id}?month=${ym}`);
      if (res.success) {setHistory(res.data || []);}
    } catch {
      /* silently fail */
    }
  }, [profile, apiGet]);

  useEffect(() => {
    if (profile?.id) {fetchHistory();}
  }, [profile?.id, fetchHistory]);

  // Check if face is registered — runs exactly once when profile.id is ready
  useEffect(() => {
    if (!profile?.id) {return;}
    let cancelled = false;
    const check = async () => {
      try {
        const { data } = await supabase
          .from('face_descriptors')
          .select('student_id')
          .eq('student_id', profile.id)
          .single();
        if (!cancelled) {
          setView(data ? 'main' : 'face-registration');
          if (typeof window !== 'undefined' && window.location.search.includes('updateFace=true')) {
            setShowReRegister(true);
          }
        }
      } catch {
        if (!cancelled) {setView('face-registration');}
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // ── Face-only attendance ─────────────────────────────────────────────────
  const markAttendanceDirectly = useCallback(async () => {
    setMarkingAttendance(true);
    setError('');
    try {
      const res = await apiPost('/api/v1/attendance/mark', {
        face_only: true,
        face_verified: true,
      });
      if (res.success) {
        setMode('success');
        setShowSuccess(true);
        fetchHistory();
      } else {
        setFaceError(res.error || 'Failed to mark attendance');
        setMode('choose');
      }
    } catch (err: unknown) {
      setFaceError((err as Error).message || 'Failed to mark attendance');
      setMode('choose');
    } finally {
      setMarkingAttendance(false);
    }
  }, [apiPost, fetchHistory]);

  // ── QR scan flow ─────────────────────────────────────────────────────────
  const runQrScan = useCallback(() => {
    setMode('qr');
    setError('');
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);
      scanner.render(
        async (text) => {
          scanner.clear();
          const el = document.getElementById('qr-reader');
          if (el) {el.innerHTML = '';}

          if (!navigator.geolocation) {
            setError('Geolocation not supported by this browser.');
            setMode('choose');
            return;
          }

          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                const res = await apiPost('/api/v1/attendance/mark', {
                  qr_data: text,
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  face_verified: false,
                });
                if (res.success) {
                  setMode('success');
                  setShowSuccess(true);
                  fetchHistory();
                } else {
                  setError(res.error || 'Failed to mark attendance');
                  setMode('choose');
                }
              } catch (err: unknown) {
                setError((err as Error).message || 'Failed to mark attendance');
                setMode('choose');
              }
            },
            (err) => {
              setError('Location access required: ' + err.message);
              setMode('choose');
            }
          );
        },
        () => {}
      );
    }, 100);
  }, [apiPost, fetchHistory]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Stable callback — defined ONCE, no deps, so SuccessAnimation timer never resets
  const handleSuccessDone = useCallback(() => {
    setShowSuccess(false);
    setMode('choose');
    window.location.replace('/student/dashboard');
  }, []);

  return (
    <PageShell spotlight="rgba(251,146,60,0.12)">
      {showSuccess && <SuccessAnimation onDone={handleSuccessDone} />}

      <PageHeader title="Mark Attendance" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* ── CHECKING FACE ── */}
        {view === 'checking-face' && (
          <div style={{
            ...panelStyle, padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
              <div className="animate-spin" style={{ width: '14px', height: '14px', border: '1.5px solid rgba(251,146,60,0.15)', borderTopColor: 'rgba(251,146,60,0.7)', borderRadius: '50%' }} />
              Checking face registration...
            </div>
          </div>
        )}

        {/* ── FACE REGISTRATION ── */}
        {view === 'face-registration' && (
          <div style={{ ...panelStyle, overflow: 'hidden', background: 'rgba(255,255,255,0.97)' }}>
            <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>Loading…</div>}>
              <FaceEnrollment
                subjectId={profile?.id ?? ''}
                role="student"
                onSuccess={() => setView('main')}
                onCancel={() => setView('main')}
              />
            </Suspense>
          </div>
        )}

        {/* ── MAIN VIEW (mode selector + history) ── */}
        {view === 'main' && !showSuccess && (
          <>
            {/* ── CHOOSE MODE ── */}
            {mode === 'choose' && (
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: '14px' }}>
                  How would you like to mark attendance?
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  {/* Face Attendance — recommended */}
                  <button
                    id="attendance-face-btn"
                    onClick={() => {
                      setFaceError('');
                      setMode('face');
                    }}
                    className="att-card-primary"
                    style={{
                      display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px', borderRadius: '16px',
                      border: `1px solid ${ORANGE_BORDER}`, background: ORANGE_SOFT, textAlign: 'left', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center' }}><Lock size={18} /></span>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>Face Recognition</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>Secure • Fast • No QR needed</p>
                    <span style={{ marginTop: '4px', alignSelf: 'flex-start', background: ORANGE, color: '#1a0f04', fontSize: '12px', fontWeight: 600, padding: '7px 14px', borderRadius: '10px' }}>
                      Start Face Scan
                    </span>
                  </button>

                  {/* QR Attendance — fallback */}
                  <button
                    id="attendance-qr-btn"
                    onClick={runQrScan}
                    className="att-card-ghost"
                    style={{
                      display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px', borderRadius: '16px',
                      border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', textAlign: 'left', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center' }}><Smartphone size={18} /></span>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>QR Code</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>Scan warden&apos;s QR code</p>
                    <span style={{ marginTop: '4px', alignSelf: 'flex-start', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 500, padding: '7px 14px', borderRadius: '10px' }}>
                      Scan QR
                    </span>
                  </button>
                </div>

                {faceError && (
                  <div style={errorBox}>{faceError}</div>
                )}
              </div>
            )}

            {/* ── FACE MODE ── */}
            {mode === 'face' && (
              <div style={{ ...panelStyle, overflow: 'hidden', marginBottom: '28px' }}>
                <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Loading…</div>}>
                  <StudentFaceVerification
                    studentId={profile?.id ?? ''}
                    onVerified={() => markAttendanceDirectly()}
                    onFailed={(_reason: string) => {
                      setFaceError(_reason);
                      setMode('choose');
                    }}
                    onSkip={() => runQrScan()}
                  />
                </Suspense>
                {markingAttendance && (
                  <div style={{ padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div className="animate-spin" style={{ width: '14px', height: '14px', border: '1.5px solid rgba(251,146,60,0.15)', borderTopColor: 'rgba(251,146,60,0.7)', borderRadius: '50%' }} />
                    Marking attendance...
                  </div>
                )}
              </div>
            )}

            {/* ── QR MODE ── */}
            {mode === 'qr' && (
              <div style={{ ...panelStyle, padding: '24px', marginBottom: '28px' }}>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '14px' }}>
                  Scan the warden&apos;s QR code to mark attendance
                </p>
                <div
                  id="qr-reader"
                  style={{ width: '100%', maxWidth: '360px', margin: '0 auto 16px', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '12px', overflow: 'hidden' }}
                />
                <button
                  onClick={() => {
                    const el = document.getElementById('qr-reader');
                    if (el) {el.innerHTML = '';}
                    setMode('choose');
                  }}
                  style={{ border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', background: 'transparent', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {error && <div style={errorBox}>{error}</div>}
          </>
        )}

        {/* ── HISTORY TABLE ── */}
        {view === 'main' && (
          <div style={{ ...panelStyle, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', margin: 0 }}>Recent attendance</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Scan Time</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
                      No attendance records yet
                    </td>
                  </tr>
                ) : (
                  history.map((item, i) => {
                    const s = STATUS_STYLES[item.status] || STATUS_STYLES.default;
                    return (
                      <tr key={item.id || i} className="row-hover" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.8)' }}>{item.date}</td>
                        <td style={tdStyle}>
                          <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.4px', color: s.color, background: s.bg, border: `0.5px solid ${s.border}`, borderRadius: '6px', padding: '3px 8px' }}>
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                        <td suppressHydrationWarning style={{ ...tdStyle, color: 'rgba(255,255,255,0.5)' }}>
                          {item.scan_time ? new Date(item.scan_time).toLocaleTimeString() : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── RE-REGISTER FACE ── */}
        {view === 'main' && (
          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
            {!showReRegister ? (
              <button
                id="update-face-btn"
                onClick={() => setShowReRegister(true)}
                style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = ORANGE)}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
              >
                Register / Update Face Data
              </button>
            ) : (
              <div style={{ ...panelStyle, overflow: 'hidden', background: 'rgba(255,255,255,0.97)' }}>
                <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>Loading…</div>}>
                  <FaceEnrollment
                    subjectId={profile?.id ?? ''}
                    role="student"
                    onSuccess={() => {
                      setShowReRegister(false);
                      setMode('choose');
                    }}
                    onCancel={() => setShowReRegister(false)}
                  />
                </Suspense>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .att-card-primary:hover { border-color: rgba(251,146,60,0.55) !important; background: rgba(251,146,60,0.18) !important; }
        .att-card-ghost:hover { border-color: rgba(255,255,255,0.2) !important; background: rgba(255,255,255,0.05) !important; }
      `}</style>
    </PageShell>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
};

const thStyle: React.CSSProperties = {
  padding: '12px 20px',
  fontSize: '11px',
  fontWeight: 500,
  color: 'rgba(255,255,255,0.4)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 20px',
};

const errorBox: React.CSSProperties = {
  marginTop: '16px',
  background: 'rgba(248,113,113,0.08)',
  border: '0.5px solid rgba(248,113,113,0.25)',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '12px',
  color: '#f87171',
};
