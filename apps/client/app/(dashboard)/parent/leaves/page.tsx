'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { Profile, LeaveRequest } from '@/types'

export default function ParentLeaves() {
  const router = useRouter();
  const supabase = createClient();
  const { apiGet } = useApi();
  const { profile, loading: profileLoading } = useProfile();
  
  const [student, setStudent] = useState<Profile | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaves = async () => {
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
          const res = await apiGet(`/api/leaves/my?studentId=${parentData.student_id}`);
          if (res.success) {
            setLeaves(res.data);
          }
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    };
    
    if (!profileLoading) {
      fetchLeaves();
    }
  }, [profile, profileLoading]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusVariant = (status: string) => {
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'danger';
    return 'warning';
  };

  if (profileLoading || loading) return <div className="min-h-screen bg-white px-6 py-10"><LoadingSpinner /></div>;

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Leave Status" showBack onSignOut={handleSignOut} />
      
      {student && (
        <div className="mb-8">
          <h2 className="text-xl font-medium text-gray-900">{student.full_name}&apos;s Leave Requests</h2>
        </div>
      )}

      <div className="overflow-x-auto border border-gray-100 rounded-xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Start Date</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">End Date</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Reason</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Applied On</th>
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center border-b border-gray-50">
                  <EmptyState message="No leave requests" />
                </td>
              </tr>
            ) : (
              leaves.map(l => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-gray-900">{l.start_date}</td>
                  <td className="px-4 py-3 text-gray-900">{l.end_date}</td>
                  <td className="px-4 py-3 text-gray-900 truncate max-w-xs">{l.reason}</td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(l.status)}>
                      {l.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(l.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
