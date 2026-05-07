'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';

export default function StudentLostFound() {
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('lost');
  const [location, setLocation] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { apiGet, apiPost } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchItems = async () => {
    try {
      const res = await apiGet('/api/lost-found');
      if (res.success) setItems(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !description || (status === 'found' && !location)) return setError('All fields required');
    
    // Optimistic UI update
    setItems(prev => [{
      id: crypto.randomUUID(),
      item_name: itemName,
      description,
      status,
      location_found: location,
      created_at: new Date().toISOString()
    }, ...(prev || [])]);

    try {
      const res = await apiPost('/api/lost-found', { item_name: itemName, description, status, location_found: location });
      if (res.success) {
        setItemName('');
        setDescription('');
        setStatus('lost');
        setLocation('');
        setError('');
        setSuccess('Report submitted successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(res.error || 'Failed to submit report');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const filteredItems = items.filter(item => {
    if (filter === 'All') return true;
    return item.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Lost & Found" showBack onSignOut={handleSignOut} />
      
      <div className="mb-8 p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors">
        <h2 className="text-sm font-medium text-gray-900 mb-4">Report Item</h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div className="flex gap-4 mb-4">
            <button type="button" onClick={() => setStatus('lost')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${status === 'lost' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>I Lost Something</button>
            <button type="button" onClick={() => setStatus('found')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${status === 'found' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>I Found Something</button>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Item Name</label>
            <input value={itemName} onChange={e => setItemName(e.target.value)} required type="text" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full" rows={3}></textarea>
          </div>
          {status === 'found' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Location Found</label>
              <input value={location} onChange={e => setLocation(e.target.value)} required type="text" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 transition-colors w-full" />
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-green-600">{success}</p>}
          <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors">Submit Report</button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">All Items Directory</h2>
        
        <div className="flex gap-4 border-b border-gray-100 mb-6 pb-2 overflow-x-auto no-scrollbar">
          {['All', 'Lost', 'Found', 'Claimed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-1 py-1 text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.length === 0 ? (
            <div className="col-span-full border border-gray-100 rounded-xl p-8">
              <EmptyState message="No items found" />
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="p-6 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors bg-white">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900">{item.item_name}</h3>
                  <Badge variant={item.status === 'lost' ? 'danger' : item.status === 'found' ? 'success' : 'default'}>
                    {item.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                <div className="text-xs text-gray-500 flex flex-col gap-1">
                  {item.location_found && <span>📍 {item.location_found}</span>}
                  <span>📅 {new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
