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

export default function StudentAttendance() {
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  
  const { profile } = useProfile();
  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (profile?.id) {
      fetchHistory();
    }
  }, [profile?.id]);

  const fetchHistory = async () => {
    if (!profile?.id) return;
    try {
      const res = await apiGet(`/api/attendance/student/${profile.id}`);
      if (res.success) setHistory(res.data.slice(0, 30) || []);
    } catch (e) {
      console.error(e);
    }
  };

  const startScanner = () => {
    setScanning(true);
    setMessage('');
    setError('');
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);
      scanner.render(async (text) => {
        scanner.clear();
        setScanning(false);
        document.getElementById('qr-reader')!.innerHTML = '';
        
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
              const res = await apiPost('/api/attendance/mark', {
                qr_data: text,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
              });
              if (res.success) {
                setMessage('✓ Attendance marked successfully!');
                fetchHistory();
              } else {
                setError(res.error || 'Failed to mark attendance');
              }
            } catch (err: any) {
              setError(err.message || 'Failed to mark attendance');
            }
          }, (err) => {
            setError('Camera access denied or geolocation required: ' + err.message);
          });
        } else {
          setError('Geolocation not supported by this browser.');
        }
      }, (err) => {
        // ignore scan errors
      });
    }, 100);
  };

  const stopScanner = () => {
    setScanning(false);
    const el = document.getElementById('qr-reader');
    if (el) el.innerHTML = '';
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusVariant = (status: string) => {
    if (status === 'present') return 'success';
    if (status === 'absent') return 'danger';
    return 'warning';
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Mark Attendance" showBack onSignOut={handleSignOut} />
      
      <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
        {!scanning ? (
          <button onClick={startScanner} className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors">
            Start Scanner
          </button>
        ) : (
          <div>
            <div id="qr-reader" className="w-full max-w-sm mx-auto mb-4 border border-gray-200 rounded-lg overflow-hidden"></div>
            <button onClick={stopScanner} className="bg-red-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-red-600 transition-colors">
              Stop Scanner
            </button>
          </div>
        )}

        {message && <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">{message}</div>}
        {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">{error}</div>}
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
                  <td className="px-4 py-3 text-gray-500">{item.scan_time ? new Date(item.scan_time).toLocaleTimeString() : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
