'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ParentContact() {
  const router = useRouter();
  const supabase = createClient();
  
  const [warden, setWarden] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWarden = async () => {
      const { data } = await supabase
        .from('staff')
        .select('*, profiles(*)')
        .eq('role', 'warden')
        .limit(1)
        .single();
        
      if (data) setWarden(data.profiles);
      setLoading(false);
    };
    
    fetchWarden();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen bg-white px-6 py-10"><LoadingSpinner /></div>;

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Contact Warden" showBack onSignOut={handleSignOut} />
      
      {warden && (
        <div className="border border-gray-100 rounded-xl p-6 mb-8 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900 mb-2">{warden.full_name}</h2>
          <div className="space-y-1 mb-6">
            <p className="text-sm text-gray-600">
              Email: <a href={`mailto:${warden.email}`} className="text-blue-600 hover:underline">{warden.email}</a>
            </p>
            <p className="text-sm text-gray-600">
              Phone: <a href={`tel:${warden.phone}`} className="text-blue-600 hover:underline">{warden.phone}</a>
            </p>
          </div>
          
          <a href={`tel:${warden.phone}`} className="block w-full text-center bg-red-500 text-white rounded-lg px-4 py-3 font-medium hover:bg-red-600 transition-colors">
            📞 Call Warden Now
          </a>
        </div>
      )}

      <div className="border border-gray-100 rounded-xl p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Hostel Information</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>Address:</strong> 123 Campus Drive, University Campus, Block B</p>
          <p><strong>Office Hours:</strong> 9:00 AM - 6:00 PM (Mon - Sat)</p>
        </div>
      </div>
    </div>
  );
}
