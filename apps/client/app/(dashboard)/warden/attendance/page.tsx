'use client';

import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface AttendanceStats {
  present?: number; absent?: number; total?: number; percentage?: number;
  today_present?: number; today_absent?: number; total_students?: number; today_percentage?: number;
  present_today?: number; absent_today?: number;
  data?: AttendanceStats;
}

interface AttendanceRecord {
  full_name?: string;
  roll_number?: string;
  status: string;
  scan_time: string | null;
  face_verified?: boolean;
  profiles?: { full_name?: string; id?: string };
}

const QR_INTERVAL = 30;

export default function WardenAttendance() {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [countdown, setCountdown] = useState(QR_INTERVAL);
  const [stats, setStats] = useState<AttendanceStats>({});
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const { apiGet } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const generateQR = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const nonce = Date.now();
    const payload = JSON.stringify({
      hostel: 'hostelmate',
      date: today,
      token: `${today}-secret123`,
      nonce,
    });
    const dataUrl = await QRCode.toDataURL(payload, {
      width: 256,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    });
    setQrCodeDataUrl(dataUrl);
  }, []);

  useEffect(() => {
    generateQR();

    const ticker = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          generateQR();
          return QR_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, [generateQR]);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, recordsRes] = await Promise.all([
        apiGet('/api/attendance/stats'),
        apiGet(`/api/attendance/today?date=${date}`),
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (recordsRes.success) setRecords(recordsRes.data || []);
    } catch { /* silently fail */ }
  }, [date, apiGet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusVariant = (status: string) => {
    if (status === 'present') return 'success';
    if (status === 'absent') return 'danger';
    return 'warning';
  };

  const s = stats?.data ?? stats;

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Attendance Management" showBack onSignOut={handleSignOut} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="border border-gray-100 rounded-xl p-6 flex flex-col items-center hover:border-gray-300 transition-colors">
          <h2 className="text-sm font-medium text-gray-900 mb-4 self-start">Daily QR Code</h2>
          {qrCodeDataUrl ? (
            <Image src={qrCodeDataUrl} alt="Attendance QR Code" width={192} height={192} className="mb-4 border border-gray-100 rounded-lg" />
          ) : (
            <div className="w-48 h-48 mb-4 bg-gray-50 flex items-center justify-center text-sm text-gray-400 rounded-lg">
              Generating...
            </div>
          )}
          <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">
            Refreshes in: {countdown}s
          </p>
        </div>

        <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Today&apos;s Stats</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Present</p>
              <p className="text-2xl font-medium text-green-600">
                {s?.today_present ?? s?.present_today ?? s?.present ?? 0}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Absent</p>
              <p className="text-2xl font-medium text-red-600">
                {s?.today_absent ?? s?.absent_today ?? s?.absent ?? 0}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Total</p>
              <p className="text-2xl font-medium text-gray-900">
                {s?.total_students ?? s?.total ?? 0}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Attendance %</p>
              <p className="text-2xl font-medium text-gray-900">
                {s?.today_percentage ?? s?.percentage ?? 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Attendance List</h2>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors"
          />
        </div>
        <table className="w-full text-left text-sm border border-gray-100 rounded-xl overflow-hidden">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Name</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Roll No</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Verified</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Scan Time</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center border-b border-gray-50">
                  <EmptyState message="No attendance records for this date" />
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {r.full_name || r.profiles?.full_name || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.roll_number || '-'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(r.status)}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.face_verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                        ✓ Face
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        QR Only
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {r.scan_time ? new Date(r.scan_time).toLocaleTimeString() : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}