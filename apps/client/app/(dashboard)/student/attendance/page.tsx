'use client';

import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useProfile } from '@/hooks/useProfile';
import { useRouter } from 'next/navigation';

interface AttendanceRecord {
  id?: string;
  date: string;
  status: string;
  scan_time: string | null;
}

function SuccessAnimation({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Animated circle */}
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="6"
            />
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
          {/* Checkmark */}
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
          <p className="text-sm text-gray-400 text-center mt-1">
            You&apos;re all set for today
          </p>
        </div>

        <style>{`
          @keyframes drawCircle {
            to { stroke-dashoffset: 0; }
          }
          @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  )
}

export default function StudentAttendance() {
  const [scanning, setScanning] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<AttendanceRecord[]>([])

  const { profile } = useProfile()
  const { apiGet, apiPost } = useApi()
  const router = useRouter()
  const supabase = createClient()

  const fetchHistory = async () => {
    if (!profile?.id) return
    try {
      const res = await apiGet(`/api/attendance/student/${profile.id}`)
      if (res.success) setHistory(res.data.slice(0, 30) || [])
    } catch {}
  }

  useEffect(() => {
    if (profile?.id) fetchHistory()
  }, [profile?.id])

  const startScanner = () => {
    setScanning(true)
    setError('')
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false)
      scanner.render(async (text) => {
        scanner.clear()
        setScanning(false)
        const el = document.getElementById('qr-reader')
        if (el) el.innerHTML = ''

        if (!navigator.geolocation) {
          setError('Geolocation not supported by this browser.')
          return
        }

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const res = await apiPost('/api/attendance/mark', {
                qr_data: text,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
              })
              if (res.success) {
                setShowSuccess(true)
                fetchHistory()
              } else {
                setError(res.error || 'Failed to mark attendance')
              }
            } catch (err: unknown) {
              setError((err as Error).message || 'Failed to mark attendance')
            }
          },
          (err) => {
            setError('Location access required: ' + err.message)
          }
        )
      }, () => {})
    }, 100)
  }

  const stopScanner = () => {
    setScanning(false)
    const el = document.getElementById('qr-reader')
    if (el) el.innerHTML = ''
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getStatusVariant = (status: string) => {
    if (status === 'present') return 'success'
    if (status === 'absent') return 'danger'
    return 'warning'
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      {showSuccess && (
        <SuccessAnimation onDone={() => setShowSuccess(false)} />
      )}

      <PageHeader title="Mark Attendance" showBack onSignOut={handleSignOut} />

      <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
        {!scanning ? (
          <button
            onClick={startScanner}
            className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Start Scanner
          </button>
        ) : (
          <div>
            <div
              id="qr-reader"
              className="w-full max-w-sm mx-auto mb-4 border border-gray-200 rounded-lg overflow-hidden"
            />
            <button
              onClick={stopScanner}
              className="border border-gray-200 text-gray-600 rounded-lg px-4 py-2.5 text-sm hover:border-gray-400 transition-colors"
            >
              Stop Scanner
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}
      </div>

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
    </div>
  )
}