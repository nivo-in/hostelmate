'use client';
import { ClipboardList, Search } from 'lucide-react';

import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { ui, panel, panelElevated, input, container } from '@/lib/ui';
import Image from 'next/image';

interface AttendanceStats {
  present?: number;
  absent?: number;
  total?: number;
  percentage?: number;
  today_present?: number;
  today_absent?: number;
  total_students?: number;
  today_percentage?: number;
  present_today?: number;
  absent_today?: number;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
      color: { dark: '#080810', light: '#ffffff' },
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
        apiGet('/api/v1/attendance/stats'),
        apiGet(`/api/v1/attendance/today?date=${date}`),
      ]);
      if (statsRes.success) {setStats(statsRes.data);}
      if (recordsRes.success) {setRecords(recordsRes.data || []);}
    } catch {
      /* silently fail */
    }
  }, [date, apiGet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusVariant = (status: string) => {
    if (status === 'present') {return 'success';}
    if (status === 'absent') {return 'danger';}
    return 'warning';
  };

  const s = stats?.data ?? stats;

  const statTiles = [
    { label: 'Present', value: s?.today_present ?? s?.present_today ?? s?.present ?? 0, color: ui.green },
    { label: 'Absent', value: s?.today_absent ?? s?.absent_today ?? s?.absent ?? 0, color: ui.red },
    { label: 'Total', value: s?.total_students ?? s?.total ?? 0, color: ui.text },
    { label: 'Attendance %', value: `${s?.today_percentage ?? s?.percentage ?? 0}%`, color: ui.text },
  ];

  const filteredRecords = records.filter((r) => {
    const name = (r.full_name || r.profiles?.full_name || '').toLowerCase();
    const roll = (r.roll_number || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || name.includes(q) || roll.includes(q);
    const matchesStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <PageShell>
      <PageHeader title="Attendance Management" showBack onSignOut={handleSignOut} />

      <div style={container}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '16px', marginBottom: '24px' }} className="att-grid">
          {/* QR card */}
          <div style={{ ...panel, padding: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 500, color: ui.text, alignSelf: 'flex-start', margin: '0 0 16px' }}>Daily QR Code</h2>
            {qrCodeDataUrl ? (
              <div style={{ padding: '10px', background: '#fff', borderRadius: '12px', marginBottom: '16px' }}>
                <Image src={qrCodeDataUrl} alt="Attendance QR Code" width={184} height={184} style={{ display: 'block', borderRadius: '6px' }} />
              </div>
            ) : (
              <div style={{ width: '204px', height: '204px', marginBottom: '16px', background: 'rgba(255,255,255,0.04)', border: ui.border, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: ui.textMuted }}>
                Generating…
              </div>
            )}
            <p style={{ fontSize: '11px', color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 500, margin: 0 }}>
              Refreshes in{' '}
              <span style={{ color: ui.accent, fontVariantNumeric: 'tabular-nums' }}>{countdown}s</span>
            </p>
          </div>

          {/* Stats card */}
          <div style={{ ...panel, padding: '22px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 500, color: ui.text, margin: '0 0 16px' }}>Today&apos;s Stats</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {statTiles.map((t) => (
                <div key={t.label} style={{ ...panelElevated, padding: '16px 18px' }}>
                  <p style={{ fontSize: '11px', color: ui.textMuted, margin: '0 0 8px' }}>{t.label}</p>
                  <p style={{ fontSize: '26px', fontWeight: 500, color: t.color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{t.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Attendance list control bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: ui.text, margin: 0 }}>Attendance List</h2>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search strokeWidth={1.5} size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: ui.textMuted }} />
              <input
                type="text"
                placeholder="Search student name or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="hm-input"
                style={{
                  ...input,
                  paddingLeft: '34px',
                  width: '100%',
                  fontSize: '13px',
                }}
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="hm-input"
              style={{
                ...input,
                width: 'auto',
                fontSize: '13px',
                colorScheme: 'dark',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>

            {/* Date Picker */}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="hm-input"
              style={{ ...input, width: 'auto', colorScheme: 'dark' }}
            />
          </div>
        </div>

        <div style={{ ...panel, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: ui.border }}>
                {['Name', 'Roll No', 'Status', 'Verified', 'Scan Time'].map((h) => (
                  <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      message={records.length === 0 ? "No attendance records for this date" : "No matching student attendance records found"}
                      icon={<ClipboardList strokeWidth={1.5} />}
                    />
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, i) => (
                  <tr key={i} className="row-hover" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 18px', color: ui.text, fontWeight: 500 }}>{r.full_name || r.profiles?.full_name || 'Unknown'}</td>
                    <td style={{ padding: '12px 18px', color: ui.textMuted }}>{r.roll_number || '-'}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <Badge variant={getStatusVariant(r.status)}>{r.status.toUpperCase()}</Badge>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      {r.face_verified ? <Badge variant="success">✓ Face</Badge> : <Badge variant="default">QR Only</Badge>}
                    </td>
                    <td style={{ padding: '12px 18px', color: ui.textMuted }}>
                      {r.scan_time ? new Date(r.scan_time).toLocaleTimeString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .att-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PageShell>
  );
}
