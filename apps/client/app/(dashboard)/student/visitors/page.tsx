'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';

interface Visitor {
  id: string;
  visitor_name: string;
  relationship: string;
  purpose: string;
  expected_visit_date: string;
  status: string;
  warden_notes?: string;
  created_at: string;
}

export default function StudentVisitors() {
  const router = useRouter();
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [purpose, setPurpose] = useState('');
  const [expectedDate, setExpectedDate] = useState('');

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { apiGet, apiPost } = useApi();
  const supabase = createClient();

  const fetchVisitors = async () => {
    try {
      const res = await apiGet('/api/v1/visitors/my');
      if (res.success) setVisitors(res.data || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim() || !visitorPhone.trim() || !purpose.trim() || !expectedDate) {
      return setError('All fields are required');
    }

    try {
      const res = await apiPost('/api/v1/visitors', {
        visitor_name: visitorName,
        visitor_phone: visitorPhone,
        purpose,
        relationship,
        expected_visit_date: expectedDate,
      });

      if (res.success) {
        setVisitorName('');
        setVisitorPhone('');
        setPurpose('');
        setExpectedDate('');
        setRelationship('parent');
        setError('');
        setSuccess('Visitor request submitted. Awaiting warden approval.');
        setTimeout(() => setSuccess(''), 5000);
        fetchVisitors();
      } else {
        setError(res.error || 'Failed to submit request');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to submit request');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusBadge = (status: string) => {
    const base = 'text-xs px-2.5 py-1 rounded-full font-medium';
    switch (status) {
      case 'pending':
        return <span className={`${base} bg-yellow-50 text-yellow-700`}>Pending</span>;
      case 'approved':
        return <span className={`${base} bg-green-50 text-green-700`}>Approved</span>;
      case 'rejected':
        return <span className={`${base} bg-red-50 text-red-700`}>Rejected</span>;
      case 'checked_in':
        return <span className={`${base} bg-blue-50 text-blue-700`}>Checked In</span>;
      case 'checked_out':
        return <span className={`${base} bg-gray-50 text-gray-600`}>Checked Out</span>;
      default:
        return null;
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Visitors" showBack onSignOut={handleSignOut} />

      <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
        <h2 className="text-sm font-medium text-gray-900 mb-4">Request New Visitor</h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Visitor Name</label>
            <input
              type="text"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              required
              minLength={2}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-500 w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
            <input
              type="tel"
              value={visitorPhone}
              onChange={(e) => setVisitorPhone(e.target.value)}
              required
              minLength={10}
              maxLength={15}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-500 w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Relationship</label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-500 w-full"
            >
              <option value="parent">Parent</option>
              <option value="sibling">Sibling</option>
              <option value="relative">Relative</option>
              <option value="friend">Friend</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Purpose of Visit</label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
              minLength={10}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-500 w-full"
              rows={3}
            ></textarea>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Expected Visit Date</label>
            <input
              type="date"
              min={today}
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              required
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-500 w-full"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-green-600">{success}</p>}

          <button
            type="submit"
            className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors mt-2"
          >
            Submit Request
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-gray-900 mb-2">My Visitor Requests</h2>
        {visitors.length === 0 ? (
          <div className="border border-gray-100 rounded-xl p-8">
            <EmptyState message="No visitor requests yet" />
          </div>
        ) : (
          visitors.map((v) => (
            <div
              key={v.id}
              className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors bg-white"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="capitalize text-sm font-medium text-gray-900">
                    {v.visitor_name}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
                    {v.relationship}
                  </span>
                </div>
                {getStatusBadge(v.status)}
              </div>
              <p className="text-sm text-gray-500 mb-2">{v.purpose}</p>
              <div className="text-xs text-gray-400">Date: {v.expected_visit_date}</div>

              {v.status === 'approved' && (
                <div className="mt-4 text-xs font-medium text-green-600">Approved ✓</div>
              )}
              {v.status === 'rejected' && v.warden_notes && (
                <div className="mt-4 text-xs text-red-600 bg-red-50 p-3 rounded-lg">
                  <span className="font-medium block mb-1">Warden Notes:</span>
                  {v.warden_notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
