'use client';

import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
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

type AttendanceView =
  | 'checking-face'       // checking if face is registered
  | 'face-registration'   // student has no face registered
  | 'choose-method'       // choose Face+QR or QR Only
  | 'face-verification'   // running face verification
  | 'qr-scan'             // QR scanner active
  | 'main';               // default history view (already marked)

function SuccessAnimation({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="45"
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
  const [view, setView] = useState<AttendanceView>('checking-face');
  const [faceVerified, setFaceVerified] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [showReRegister, setShowReRegister] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');

  const { profile } = useProfile();
  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchHistory = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const res = await apiGet(`/api/attendance/student/${profile.id}`);
      if (res.success) setHistory(res.data.slice(0, 30) || []);
    } catch { /* silently fail */ }
  }, [profile, apiGet]);

  useEffect(() => {
    if (profile?.id) fetchHistory();
  }, [profile?.id, fetchHistory]);

  // Check if face is registered — runs exactly once when profile.id is ready
  const hasFaceChecked = useCallback(() => {}, []); // stable identity used as mount guard
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
        if (!cancelled) setView(data ? 'choose-method' : 'face-registration');
      } catch {
        if (!cancelled) setView('face-registration');
      }
    };
    check();
    return () => { cancelled = true; };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const runQrScan = (isFaceVerified: boolean) => {
    setFaceVerified(isFaceVerified);
    setView('qr-scan');
    setError('');
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);
      scanner.render(async (text) => {
        scanner.clear();
        setView('main');
        const el = document.getElementById('qr-reader');
        if (el) el.innerHTML = '';

        if (!navigator.geolocation) {
          setError('Geolocation not supported by this browser.');
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const res = await apiPost('/api/attendance/mark', {
                qr_data: text,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                face_verified: isFaceVerified,
              });
              if (res.success) {
                setShowSuccess(true);
                fetchHistory();
              } else {
                setError(res.error || 'Failed to mark attendance');
              }
            } catch (err: unknown) {
              setError((err as Error).message || 'Failed to mark attendance');
            }
          },
          (err) => {
            setError('Location access required: ' + err.message);
          }
        );
      }, () => {});
    }, 100);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const getStatusVariant = (status: string) => {
    if (status === 'present') return 'success';
    if (status === 'absent') return 'danger';
    return 'warning';
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      {showSuccess && <SuccessAnimation onDone={() => { setShowSuccess(false); setView('main'); }} />}

      <PageHeader title="Mark Attendance" showBack onSignOut={handleSignOut} />

      {/* ── FACE REGISTRATION ── */}
      {(view === 'checking-face') && (
        <div className="mb-8 p-6 border border-gray-100 rounded-xl flex items-center justify-center min-h-40">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Checking face registration...
          </div>
        </div>
      )}

      {view === 'face-registration' && (
        <div className="mb-8 border border-gray-100 rounded-xl overflow-hidden">
          <Suspense fallback={<div className="p-8 text-center text-sm text-gray-400">Loading...</div>}>
            <FaceRegistration
              studentId={profile?.id ?? ''}
              onSuccess={() => setView('choose-method')}
              onSkip={() => setView('choose-method')}
            />
          </Suspense>
        </div>
      )}

      {/* ── METHOD SELECTOR ── */}
      {view === 'choose-method' && (
        <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
          <h2 className="text-sm font-medium text-gray-900 mb-4">How would you like to mark attendance?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Face + QR */}
            <button
              id="attendance-face-qr-btn"
              onClick={() => setView('face-verification')}
              className="flex flex-col gap-1 p-4 rounded-xl border border-gray-200 text-left hover:border-gray-900 hover:bg-gray-50 transition-all group"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🪪</span>
                <span className="text-sm font-medium text-gray-900 group-hover:text-gray-900">
                  Face + QR Attendance
                </span>
              </div>
              <p className="text-xs text-gray-400 ml-6">Recommended — verified &amp; secure</p>
            </button>

            {/* QR Only */}
            <button
              id="attendance-qr-only-btn"
              onClick={() => {
                setWarningMsg('Face verification skipped — this may be flagged.');
                runQrScan(false);
              }}
              className="flex flex-col gap-1 p-4 rounded-xl border border-gray-200 text-left hover:border-gray-400 hover:bg-gray-50 transition-all group"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">📷</span>
                <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">
                  QR Only
                </span>
              </div>
              <p className="text-xs text-gray-400 ml-6">No face verification</p>
            </button>
          </div>

          {warningMsg && (
            <p className="mt-3 text-xs text-amber-600 font-medium">{warningMsg}</p>
          )}
        </div>
      )}

      {/* ── FACE VERIFICATION ── */}
      {view === 'face-verification' && (
        <div className="mb-8 border border-gray-100 rounded-xl overflow-hidden">
          <Suspense fallback={<div className="p-8 text-center text-sm text-gray-400">Loading...</div>}>
            <FaceVerification
              studentId={profile?.id ?? ''}
              onVerified={() => runQrScan(true)}
              onFailed={(reason) => {
                setError(reason);
                setView('choose-method');
              }}
              onSkip={() => runQrScan(false)}
            />
          </Suspense>
        </div>
      )}

      {/* ── QR SCANNER ── */}
      {view === 'qr-scan' && (
        <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
          {faceVerified && (
            <p className="text-xs text-green-600 font-medium mb-3">✓ Face verified — scan the QR code to complete</p>
          )}
          <div
            id="qr-reader"
            className="w-full max-w-sm mx-auto mb-4 border border-gray-200 rounded-lg overflow-hidden"
          />
          <button
            onClick={() => {
              setScanning(false);
              setView('choose-method');
              const el = document.getElementById('qr-reader');
              if (el) el.innerHTML = '';
            }}
            className="border border-gray-200 text-gray-600 rounded-lg px-4 py-2.5 text-sm hover:border-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── DEFAULT MAIN VIEW ── */}
      {(view === 'main') && !showSuccess && (
        <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
          <button
            id="mark-attendance-btn"
            onClick={() => setView('choose-method')}
            className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Mark Attendance Again
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}

      {/* ── HISTORY TABLE ── */}
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

      {/* ── RE-REGISTER FACE ── */}
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
            <Suspense fallback={<div className="p-8 text-center text-sm text-gray-400">Loading...</div>}>
              <FaceRegistration
                studentId={profile?.id ?? ''}
                onSuccess={() => { setShowReRegister(false); setView('choose-method'); }}
                onSkip={() => setShowReRegister(false)}
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* suppress unused var warning */}
      {scanning && null}
    </div>
  );
}