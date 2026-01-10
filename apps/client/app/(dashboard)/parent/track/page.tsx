'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { Profile, Attendance } from '@/types'

export default function ParentTrack() {
  const router = useRouter();
  const supabase = createClient();
  const { apiGet } = useApi();
  const { profile, loading: profileLoading } = useProfile();
  
  const [student, setStudent] = useState<Profile | null>(null);
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudent = async () => {
      if (!profile?.id) return;
      
      const { data: parentData } = await supabase
        .from('parents')
        .select('student_id')
        .eq('profile_id', profile.id)
        .single();
        
      if (parentData?.student_id) {
        const { data: studentData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', parentData.student_id)
          .single();
          
        setStudent(studentData);
        
        try {
          const res = await apiGet(`/api/attendance/student/${parentData.student_id}?month=current`);
          if (res.success) {
            const todayStr = new Date().toISOString().split('T')[0];
            const today = res.data.find((r: Attendance) => r.date === todayStr);
            setTodayRecord(today || null);
          }
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    };
    
    if (!profileLoading) {
      fetchStudent();
    }
  }, [profile, profileLoading]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (profileLoading || loading) return <div className="min-h-screen bg-white px-6 py-10"><LoadingSpinner /></div>;

  const renderTodayStatus = () => {
    if (!todayRecord) {
      return (
        <div className="flex flex-col items-center justify-center p-8 border border-gray-100 rounded-xl mb-8">
          <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <span className="text-3xl text-gray-400">?</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900">Not marked yet</h2>
        </div>
      );
    }
    
    if (todayRecord.status === 'present') {
      return (
        <div className="flex flex-col items-center justify-center p-8 border border-gray-100 rounded-xl mb-8">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <span className="text-3xl text-green-600">✓</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900">Present Today</h2>
          {todayRecord.scan_time && <p className="text-sm text-gray-500 mt-1">Scanned at {new Date(todayRecord.scan_time).toLocaleTimeString()}</p>}
        </div>
      );
    }
    
    if (todayRecord.status === 'absent') {
      return (
        <div className="flex flex-col items-center justify-center p-8 border border-gray-100 rounded-xl mb-8">
          <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <span className="text-3xl text-red-600">✗</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900">Not marked today</h2>
        </div>
      );
    }
    
    if (todayRecord.status === 'leave') {
      return (
        <div className="flex flex-col items-center justify-center p-8 border border-gray-100 rounded-xl mb-8">
          <div className="w-24 h-24 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
            <span className="text-3xl text-yellow-600">✈</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900">On Leave</h2>
        </div>
      );
    }
  };

  // Calendar logic mockup
  const renderCalendar = () => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const cells = Array.from({ length: 30 }).map((_, i) => i + 1);
    const today = new Date().getDate();

    return (
      <div className="border border-gray-100 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">30-day Calendar</h3>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => <div key={i} className="text-center text-xs text-gray-500 font-medium pb-2">{d}</div>)}
          {cells.map(day => (
            <div 
              key={day} 
              className={`aspect-square flex items-center justify-center text-xs rounded-md ${
                day === today ? 'ring-2 ring-gray-900' : ''
              } bg-gray-50 text-gray-600`}
            >
              {day}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Track Student" showBack onSignOut={handleSignOut} />
      
      {student && (
        <div className="mb-8">
          <h2 className="text-xl font-medium text-gray-900">{student.full_name}</h2>
          <p className="text-sm text-gray-500">Student ID: {student.id}</p>
        </div>
      )}

      {renderTodayStatus()}
      {renderCalendar()}
    </div>
  );
}
