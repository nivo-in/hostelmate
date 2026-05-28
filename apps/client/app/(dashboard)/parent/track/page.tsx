'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useProfile } from '@/hooks/useProfile';
import { useSocket } from '@/hooks/useSocket';

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

export default function ParentTrack() {
  const supabase = createClient();
  const { apiGet } = useApi();
  const { profile, loading: profileLoading } = useProfile();

  const [data, setData] = useState<ParentStudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref so the WebSocket handler always has the latest student id (avoids stale closure)
  const studentIdRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiGet('/api/parent/my-student');
      if (res.success) {
        setData(res.data);
        studentIdRef.current = res.data.student.id;
        setError(null);
      } else {
        setError(res.error || 'Failed to load student data');
      }
    } catch {
      setError('Failed to load student data');
    } finally {
      setLoading(false);
    }
  }, [apiGet]);

  useEffect(() => {
    if (!profileLoading && profile?.id) {
      fetchData();
    }
  }, [profile?.id, profileLoading, fetchData]);

  // WebSocket: re-fetch when student marks attendance
  useSocket({
    'attendance:marked': (payload: unknown) => {
      const data = payload as { student_id?: string };
      // Only refetch if the event is for our linked student
      if (!studentIdRef.current || data?.student_id === studentIdRef.current) {
        fetchData();
      }
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-white px-6 py-10">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
        <PageHeader title="Track Student" showBack onSignOut={handleSignOut} />
        <div className="mt-8 p-6 border border-red-100 bg-red-50 rounded-xl text-center">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <p className="text-gray-400 text-xs mt-1">No student is linked to this parent account yet.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { student, today_attendance } = data;

  const renderTodayStatus = () => {
    if (!today_attendance) {
      return (
        <div className="flex flex-col items-center justify-center p-8 border border-gray-100 rounded-xl mb-8">
          <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <span className="text-3xl text-gray-400">?</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900">Not marked yet</h2>
          <p className="text-sm text-gray-400 mt-1">Attendance hasn&apos;t been recorded for today</p>
        </div>
      );
    }

    if (today_attendance.status === 'present') {
      return (
        <div className="flex flex-col items-center justify-center p-8 border border-green-100 bg-green-50 rounded-xl mb-8">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <span className="text-3xl text-green-600">✓</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900">Present Today</h2>
          {today_attendance.scan_time && (
            <p className="text-sm text-gray-500 mt-1">
              Marked at {new Date(today_attendance.scan_time).toLocaleTimeString()}
            </p>
          )}
        </div>
      );
    }

    if (today_attendance.status === 'absent') {
      return (
        <div className="flex flex-col items-center justify-center p-8 border border-red-100 bg-red-50 rounded-xl mb-8">
          <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <span className="text-3xl text-red-600">✗</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900">Absent Today</h2>
        </div>
      );
    }

    if (today_attendance.status === 'leave') {
      return (
        <div className="flex flex-col items-center justify-center p-8 border border-yellow-100 bg-yellow-50 rounded-xl mb-8">
          <div className="w-24 h-24 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
            <span className="text-3xl text-yellow-600">✈</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900">On Leave</h2>
        </div>
      );
    }
  };

  const renderCalendar = () => {
    const { month_attendance } = data;
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const todayDate = today.getDate();

    const attendanceMap = new Map<string, string>();
    month_attendance.forEach(r => {
      attendanceMap.set(r.date, r.status);
    });

    const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const blanks = Array.from({ length: firstDay });
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getColor = (day: number) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const status = attendanceMap.get(dateStr);
      if (status === 'present') return 'bg-green-100 text-green-700';
      if (status === 'absent') return 'bg-red-100 text-red-600';
      if (status === 'leave') return 'bg-yellow-100 text-yellow-600';
      return 'bg-gray-50 text-gray-400';
    };

    return (
      <div className="border border-gray-100 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">
          {today.toLocaleString('default', { month: 'long', year: 'numeric' })} Calendar
        </h3>
        <div className="grid grid-cols-7 gap-1">
          {dayHeaders.map((d, i) => (
            <div key={i} className="text-center text-xs text-gray-400 font-medium pb-2">{d}</div>
          ))}
          {blanks.map((_, i) => <div key={`b-${i}`} />)}
          {days.map(day => (
            <div
              key={day}
              className={`aspect-square flex items-center justify-center text-xs rounded-md font-medium ${getColor(day)} ${day === todayDate ? 'ring-2 ring-gray-900' : ''}`}
            >
              {day}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-100 inline-block" /> Present</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 inline-block" /> Absent</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-100 inline-block" /> Leave</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Track Student" showBack onSignOut={handleSignOut} />

      {/* Student info */}
      <div className="mb-6 p-4 border border-gray-100 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-medium text-gray-600">
            {student.full_name?.[0] ?? '?'}
          </div>
          <div>
            <h2 className="text-base font-medium text-gray-900">{student.full_name}</h2>
            <p className="text-xs text-gray-400">
              {student.roll_number && <span className="mr-2">{student.roll_number}</span>}
              {student.room_number && <span>Room {student.room_number}{student.block_name ? ` · ${student.block_name}` : ''}</span>}
            </p>
          </div>
        </div>
      </div>

      {renderTodayStatus()}
      {renderCalendar()}
    </div>
  );
}
