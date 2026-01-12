'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { useApi } from '@/hooks/useApi';
import dynamic from 'next/dynamic';

const WardenFaceRegistration = dynamic(
  () => import('@/components/face/WardenFaceRegistration'),
  { ssr: false }
);

const SkeletonCard = () => (
  <div className="border border-gray-100 rounded-xl p-6 animate-pulse">
    <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-2/3" />
  </div>
);

const SkeletonStat = () => (
  <div className="border border-gray-100 rounded-xl p-4 animate-pulse">
    <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
    <div className="h-6 bg-gray-100 rounded w-1/3" />
  </div>
);

interface StatsData {
  attendanceToday: number;
  pendingLeaves: number;
  openComplaints: number;
  activeNotices: number;
}

interface StatsApiResponse {
  success: boolean;
  data: {
    attendance?: { today_percentage?: number };
    leaves?: { pending_count?: number };
    complaints?: { open_count?: number };
    notices?: { total_active?: number };
  };
}

export default function WardenDashboard() {
  const [firstName, setFirstName] = useState('');
  const [wardenId, setWardenId] = useState('');
  const [showFaceRegister, setShowFaceRegister] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData>({
    attendanceToday: 0,
    pendingLeaves: 0,
    openComplaints: 0,
    activeNotices: 0,
  });

  const router = useRouter();
  const supabase = createClient();
  const { apiGet } = useApi();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      setWardenId(user.id);

      // All fetches run in parallel
      const [profileResult, statsResult, faceResult] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        (apiGet('/api/stats/dashboard') as Promise<StatsApiResponse>).catch(() => null),
        supabase.from('warden_face_descriptors').select('warden_id').eq('warden_id', user.id).single(),
      ]);

      if (profileResult.data?.full_name) {
        setFirstName(profileResult.data.full_name.split(' ')[0]);
      }

      if (statsResult?.success && statsResult.data) {
        setStats({
          attendanceToday: statsResult.data.attendance?.today_percentage ?? 0,
          pendingLeaves: statsResult.data.leaves?.pending_count ?? 0,
          openComplaints: statsResult.data.complaints?.open_count ?? 0,
          activeNotices: statsResult.data.notices?.total_active ?? 0,
        });
      }

      setFaceRegistered(!!faceResult.data);
      setLoading(false);
    };

    init();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title={loading ? 'Hello 👋' : `Hello ${firstName} 👋`} onSignOut={handleSignOut} />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card emoji="📋" title="Attendance" description="View and manage attendance" href="/warden/attendance" />
          <Card emoji="✅" title="Leave Management" description="Approve or reject leaves" href="/warden/leaves" />
          <Card emoji="🔧" title="Complaints" description="Track and resolve issues" href="/warden/complaints" />
          <Card emoji="🍽️" title="Mess Management" description="Update weekly menu" href="/warden/mess" />
          <Card emoji="📢" title="Notices" description="Post announcements" href="/warden/notices" />
          <Card emoji="👥" title="Staff Directory" description="Manage staff contacts" href="/warden/staff" />
          <Card emoji="🔍" title="Lost & Found" description="Oversee item directory" href="/warden/lost-found" />
          <Card emoji="🚨" title="Emergency" description="Send emergency alerts" href="/warden/emergency" />
          <Card emoji="🏠" title="Room Allocation" description="Manage rooms and assignments" href="/warden/rooms" />
          <Card emoji="🌙" title="Curfew Management" description="Track and notify curfew violations" href="/warden/curfew" />
          <Card emoji="📋" title="Audit Log" description="View all system activity" href="/warden/audit" />
        </div>
      )}

      {/* Face Security Section */}
      {!loading && (
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
              <WardenFaceRegistration
                wardenId={wardenId}
                onSuccess={() => {
                  setShowFaceRegister(false);
                  setFaceRegistered(true);
                }}
                onSkip={() => setShowFaceRegister(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
