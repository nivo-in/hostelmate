'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { useApi } from '@/hooks/useApi';

export default function WardenDashboard() {
  const [firstName, setFirstName] = useState('');
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
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        if (profile?.full_name) {
          setFirstName(profile.full_name.split(' ')[0]);
        }
      }
    };
    
    const fetchStats = async () => {
      try {
        const res = await apiGet('/api/stats/dashboard');
        if (res.success && res.data) {
          setStats({
            attendanceToday: res.data.attendance || 0,
            pendingLeaves: res.data.pendingLeaves || 0,
            openComplaints: res.data.openComplaints || 0,
            activeNotices: res.data.activeNotices || 0
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchProfile();
    fetchStats();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
    </div>
  );
}
