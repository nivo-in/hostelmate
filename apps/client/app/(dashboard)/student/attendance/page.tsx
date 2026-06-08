'use client';

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useProfile } from '@/hooks/useProfile';
import { useRouter } from 'next/navigation';

// Lazy-load face components so face-api.js is not bundled in initial chunk
const FaceRegistration = lazy(() => import('@/components/face/FaceRegistration'));
const FaceVerification = lazy(() => import('@/components/face/FaceVerification'));

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
// avoids the stale-closure timer-reset bug caused by inline arrow functions
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm cursor-pointer"
      onClick={onDone}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#111827"
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
              stroke="#111827"
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
          <p className="text-xl font-medium tracking-tight text-gray-900 text-center">
            Attendance Marked
          </p>
          <p className="text-sm text-gray-400 text-center mt-1">You&apos;re all set for today</p>
          <p className="text-xs text-gray-300 text-center mt-4">Click anywhere to continue</p>
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
    if (!profile?.id) return;
    try {
      const res = await apiGet(`/api/v1/attendance/student/${profile.id}`);
      if (res.success) setHistory(res.data.slice(0, 30) || []);
    } catch {
      /* silently fail */
    }
  }, [profile, apiGet]);

  useEffect(() => {
    if (profile?.id) fetchHistory();
  }, [profile?.id, fetchHistory]);

  // Check if face is registered — runs exactly once when profile.id is ready
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    const check = async () => {
      try {
        const { data } = await supabase
          .from('face_descriptors')
          .select('student_id')
          .eq('student_id', profile.id)
          .single();
        if (!cancelled) setView(data ? 'main' : 'face-registration');
      } catch {
        if (!cancelled) setView('face-registration');
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
          if (el) el.innerHTML = '';

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

  const getStatusVariant = (status: string) => {
    if (status === 'present') return 'success';
    if (status === 'absent') return 'danger';
    return 'warning';
  };

  // Stable callback — defined ONCE, no deps, so SuccessAnimation timer never resets
  const handleSuccessDone = useCallback(() => {
    setShowSuccess(false);
    setMode('choose');
    window.location.replace('/student/dashboard');
  }, []);

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      {showSuccess && <SuccessAnimation onDone={handleSuccessDone} />}

      <PageHeader title="Mark Attendance" showBack onSignOut={handleSignOut} />

      {/* ── CHECKING FACE ── */}
      {view === 'checking-face' && (
        <div className="mb-8 p-6 border border-gray-100 rounded-xl flex items-center justify-center min-h-40">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Checking face registration...
          </div>
        </div>
      )}

      {/* ── FACE REGISTRATION ── */}
      {view === 'face-registration' && (
        <div className="mb-8 border border-gray-100 rounded-xl overflow-hidden">
          <Suspense
            fallback={<div className="p-8 text-center text-sm text-gray-400">Loading...</div>}
          >
            <FaceRegistration
              studentId={profile?.id ?? ''}
              onSuccess={() => setView('main')}
              onSkip={() => setView('main')}
            />
          </Suspense>
        </div>
      )}

      {/* ── MAIN VIEW (mode selector + history) ── */}
      {view === 'main' && !showSuccess && (
        <>
          {/* ── CHOOSE MODE ── */}
          {mode === 'choose' && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-gray-900 mb-4">
                How would you like to mark attendance?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Face Attendance — recommended */}
                <button
                  id="attendance-face-btn"
                  onClick={() => {
                    setFaceError('');
                    setMode('face');
                  }}
                  className="flex flex-col gap-2 p-5 rounded-xl border-2 border-gray-900 text-left hover:bg-gray-50 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔐</span>
                    <span className="text-sm font-medium text-gray-900">Face Recognition</span>
                  </div>
                  <p className="text-xs text-gray-400">Secure • Fast • No QR needed</p>
                  <span className="mt-1 inline-block bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg self-start">
                    Start Face Scan
                  </span>
                </button>

                {/* QR Attendance — fallback */}
                <button
                  id="attendance-qr-btn"
                  onClick={runQrScan}
                  className="flex flex-col gap-2 p-5 rounded-xl border border-gray-100 text-left hover:border-gray-300 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📱</span>
                    <span className="text-sm font-medium text-gray-600">QR Code</span>
                  </div>
                  <p className="text-xs text-gray-400">Scan warden&apos;s QR code</p>
                  <span className="mt-1 inline-block border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg self-start">
                    Scan QR
                  </span>
                </button>
              </div>

              {faceError && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {faceError}
                </div>
              )}
            </div>
          )}

          {/* ── FACE MODE ── */}
          {mode === 'face' && (
            <div className="mb-8 border border-gray-100 rounded-xl overflow-hidden">
              <Suspense
                fallback={<div className="p-8 text-center text-sm text-gray-400">Loading...</div>}
              >
                <FaceVerification
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
                <div className="p-4 flex items-center justify-center gap-2 text-sm text-gray-500 border-t border-gray-100">
                  <svg
                    className="animate-spin w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Marking attendance...
                </div>
              )}
            </div>
          )}

          {/* ── QR MODE ── */}
          {mode === 'qr' && (
            <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
              <p className="text-xs text-gray-500 mb-3">
                Scan the warden&apos;s QR code to mark attendance
              </p>
              <div
                id="qr-reader"
                className="w-full max-w-sm mx-auto mb-4 border border-gray-200 rounded-lg overflow-hidden"
              />
              <button
                onClick={() => {
                  const el = document.getElementById('qr-reader');
                  if (el) el.innerHTML = '';
                  setMode('choose');
                }}
                className="border border-gray-200 text-gray-600 rounded-lg px-4 py-2.5 text-sm hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}
        </>
      )}

      {/* ── HISTORY TABLE ── */}
      {view === 'main' && (
        <div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 font-medium text-xs text-gray-500">Date</th>
                <th className="px-4 py-3 font-medium text-xs text-gray-500">Status</th>
                <th className="px-4 py-3 font-medium text-xs text-gray-500">Scan Time</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-center border-b border-gray-50">
                    <EmptyState message="No attendance records yet" />
                  </td>
                </tr>
              ) : (
                history.map((item, i) => (
                  <tr key={item.id || i} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-gray-900">{item.date}</td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(item.status)}>
                        {item.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.scan_time ? new Date(item.scan_time).toLocaleTimeString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── RE-REGISTER FACE ── */}
      {view === 'main' && (
        <div className="mt-8 pt-6 border-t border-gray-100">
          {!showReRegister ? (
            <button
              id="update-face-btn"
              onClick={() => setShowReRegister(true)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Register / Update Face Data
            </button>
          ) : (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <Suspense
                fallback={<div className="p-8 text-center text-sm text-gray-400">Loading...</div>}
              >
                <FaceRegistration
                  studentId={profile?.id ?? ''}
                  onSuccess={() => {
                    setShowReRegister(false);
                    setMode('choose');
                  }}
                  onSkip={() => setShowReRegister(false)}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
