'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';

const SkeletonCard = () => (
  <div className="border border-gray-100 rounded-xl p-6 animate-pulse">
    <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-2/3" />
  </div>
);

export default function StudentDashboard() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(true);

  const init = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const [profileResult] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      ]);

      if (profileResult.data?.full_name) {
        setFirstName(profileResult.data.full_name.split(' ')[0]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <PageHeader
        title={loading ? 'Hello 👋' : `Hello ${firstName} 👋`}
        onSignOut={handleSignOut}
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            emoji="📋"
            title="Attendance"
            description="Mark your daily attendance"
            href="/student/attendance"
          />
          <Card
            emoji="🏖️"
            title="Leave Request"
            description="Apply for leave"
            href="/student/leaves"
          />
          <Card
            emoji="🔧"
            title="Complaints"
            description="Report a maintenance issue"
            href="/student/complaints"
          />
          <Card
            emoji="🍽️"
            title="Mess"
            description="View menu and rate meals"
            href="/student/mess"
          />
          <Card
            emoji="📢"
            title="Notices"
            description="Read announcements"
            href="/student/notices"
          />
          <Card
            emoji="🔍"
            title="Lost & Found"
            description="Report or find items"
            href="/student/lost-found"
          />
          <Card
            emoji="⭐"
            title="Staff Feedback"
            description="Rate hostel staff"
            href="/student/staff-feedback"
          />
          <Card
            emoji="🔄"
            title="Room Transfer"
            description="Request a room change"
            href="/student/room-transfer"
          />
          <Card
            emoji="👥"
            title="Visitors"
            description="Request visitor passes"
            href="/student/visitors"
          />
          <Card
            emoji="💳"
            title="Fee Payments"
            description="Pay hostel and mess fees online"
            href="/student/payments"
          />
        </div>
      )}
    </div>
  );
}
