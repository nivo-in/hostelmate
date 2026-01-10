'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { useApi } from '@/hooks/useApi';

const WardenFaceRegistration = lazy(() => import('@/components/face/WardenFaceRegistration'));

export default function WardenDashboard() {
  const [firstName, setFirstName] = useState('');
  const [wardenId, setWardenId] = useState('');
  const [showFaceRegister, setShowFaceRegister] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [stats, setStats] = useState({
    attendanceToday: 0,
    pendingLeaves: 0,
    openComplaints: 0,
    activeNotices: 0
  });
  
  const router = useRouter();
  const supabase = createClient();
  const { apiGet } = useApi();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setWardenId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        if (profile?.full_name) {
          setFirstName(profile.full_name.split(' ')[0]);
        }

        // Check if warden has face registered
        const { data: faceData } = await supabase
          .from('warden_face_descriptors')
          .select('warden_id')
          .eq('warden_id', user.id)
          .single();
        setFaceRegistered(!!faceData);
      }
    };
    
    const fetchStats = async () => {
  try {
    const res = await apiGet('/api/stats/dashboard')
    if (res.success && res.data) {
      setStats({
        attendanceToday: res.data.attendance?.today_percentage ?? 0,
        pendingLeaves: res.data.leaves?.pending_count ?? 0,
        openComplaints: res.data.complaints?.open_count ?? 0,
        activeNotices: res.data.notices?.total_active ?? 0
      })
    }
  } catch (e) {
    console.error(e)
  }
}

    fetchProfile();
    fetchStats();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title={`Hello ${firstName} 👋`} onSignOut={handleSignOut} />
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="border border-gray-100 rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <span>📋</span>
            <span className="text-xs text-gray-400">Attendance Today</span>
          </div>
          <p className="text-2xl font-medium text-gray-900">{stats.attendanceToday}%</p>
        </div>
        
        <div className="border border-gray-100 rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <span>⏳</span>
            <span className="text-xs text-gray-400">Pending Leaves</span>
          </div>
          <p className="text-2xl font-medium text-gray-900">{stats.pendingLeaves}</p>
        </div>
        
        <div className="border border-gray-100 rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <span>🔧</span>
            <span className="text-xs text-gray-400">Open Complaints</span>
          </div>
          <p className="text-2xl font-medium text-gray-900">{stats.openComplaints}</p>
        </div>
        
        <div className="border border-gray-100 rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <span>📢</span>
            <span className="text-xs text-gray-400">Active Notices</span>
          </div>
          <p className="text-2xl font-medium text-gray-900">{stats.activeNotices}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card 
          emoji="📋" 
          title="Attendance" 
          description="View and manage attendance" 
          href="/warden/attendance" 
        />
        <Card 
          emoji="✅" 
          title="Leave Management" 
          description="Approve or reject leaves" 
          href="/warden/leaves" 
        />
        <Card 
          emoji="🔧" 
          title="Complaints" 
          description="Track and resolve issues" 
          href="/warden/complaints" 
        />
        <Card 
          emoji="🍽️" 
          title="Mess Management" 
          description="Update weekly menu" 
          href="/warden/mess" 
        />
        <Card 
          emoji="📢" 
          title="Notices" 
          description="Post announcements" 
          href="/warden/notices" 
        />
        <Card 
          emoji="👥" 
          title="Staff Directory" 
          description="Manage staff contacts" 
          href="/warden/staff" 
        />
        <Card 
          emoji="🔍" 
          title="Lost & Found" 
          description="Oversee item directory" 
          href="/warden/lost-found" 
        />
        <Card 
          emoji="🚨" 
          title="Emergency" 
          description="Send emergency alerts" 
          href="/warden/emergency" 
        />
      </div>

      {/* ── FACE SECURITY SECTION ── */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Login Face Security</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {faceRegistered
                ? 'Face data registered — verified on each login'
                : 'No face registered — add one to secure your login'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {faceRegistered && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Active
              </span>
            )}
            <button
              id="warden-manage-face-btn"
              onClick={() => setShowFaceRegister(!showFaceRegister)}
              className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 transition-colors"
            >
              {showFaceRegister ? 'Cancel' : faceRegistered ? 'Update Face' : 'Register Face'}
            </button>
          </div>
        </div>

        {showFaceRegister && wardenId && (
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <Suspense fallback={
              <div className="p-8 text-center text-sm text-gray-400">
                Loading face recognition...
              </div>
            }>
              <WardenFaceRegistration
                wardenId={wardenId}
                onSuccess={() => {
                  setShowFaceRegister(false);
                  setFaceRegistered(true);
                }}
                onSkip={() => setShowFaceRegister(false)}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
