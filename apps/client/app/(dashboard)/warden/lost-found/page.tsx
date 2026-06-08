'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { LostAndFound } from '@/types';

export default function WardenLostFound() {
  const [activeTab, setActiveTab] = useState('All');
  const [items, setItems] = useState<LostAndFound[]>([]);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const { apiGet, apiPatch } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchItems = async (currentPage = 1) => {
    try {
      const res = await apiGet(`/api/v1/lost-found?page=${currentPage}&limit=20`);
      if (res.success) {
        if (currentPage === 1) {
          setItems(res.data || []);
        } else {
          setItems((prev) => [...prev, ...(res.data || [])]);
        }
        setHasNext(res.pagination?.hasNext || false);
      }
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchItems(1);
  }, []);

  const handleClaim = async (id: string) => {
    try {
      const res = await apiPatch(`/api/v1/lost-found/${id}/claim`, {});
      if (res.success) {
        setMessage('Item marked as claimed');
        fetchItems();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch {
      // Silently fail
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusVariant = (status: string) => {
    if (status === 'claimed') return 'success';
    if (status === 'lost') return 'danger';
    return 'warning';
  };

  const filteredItems = items.filter((i) => {
    if (activeTab === 'All') return true;
    return i.status.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Lost & Found" showBack onSignOut={handleSignOut} />

      {message && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
          {message}
        </div>
      )}

      <div className="flex gap-4 border-b border-gray-100 mb-8 pb-2 overflow-x-auto no-scrollbar">
        {['All', 'Lost', 'Found', 'Claimed'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-1 py-1 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-gray-100 rounded-xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Item Name</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Description</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Location</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Reported By</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Date</th>
              <th className="px-4 py-3 font-medium text-xs text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center border-b border-gray-50">
                  <EmptyState
                    message={`No ${activeTab !== 'All' ? activeTab.toLowerCase() : ''} items found`}
                  />
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{item.item_name}</td>
                  <td
                    className="px-4 py-3 text-gray-600 max-w-[150px] truncate"
                    title={item.description}
                  >
                    {item.description}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(item.status)}>
                      {item.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{item.location_found || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {(item as unknown as { students?: { profiles?: { full_name?: string } } })
                      .students?.profiles?.full_name || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {item.status !== 'claimed' && (
                      <button
                        onClick={() => handleClaim(item.id)}
                        className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-700 transition-colors"
                      >
                        Mark Claimed
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasNext && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchItems(nextPage);
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
