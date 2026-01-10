'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useApi } from '@/hooks/useApi';
import { createClient } from '@/lib/supabase/client';

type Room = {
  id: string;
  room_number: string;
  block_name: string;
  capacity: number;
  occupancy: number;
};

type MyTransferRequest = {
  id: string;
  requested_room: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

type CurrentRoomInfo = {
  room_number: string;
  block_name: string;
  roommates: string[];
};

export default function StudentRoomTransferPage() {
  const [currentRoom, setCurrentRoom] = useState<CurrentRoomInfo | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [myRequests, setMyRequests] = useState<MyTransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const { apiGet, apiPost } = useApi();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch current room info
      const { data: studentData } = await supabase
        .from('students')
        .select('room_id, rooms(room_number, block_name)')
        .eq('id', session.user.id)
        .single();

      if (studentData?.room_id) {
        // Fetch roommates
        const { data: roommatesData } = await supabase
          .from('students')
          .select('id, profiles!inner(full_name)')
          .eq('room_id', studentData.room_id)
          .neq('id', session.user.id);
          
        setCurrentRoom({
          room_number: (studentData.rooms as any)?.room_number || 'Unknown',
          block_name: (studentData.rooms as any)?.block_name || '',
          roommates: roommatesData ? roommatesData.map((r: any) => r.profiles?.full_name) : []
        });
      }

      // Fetch available rooms
      const roomsRes = await apiGet('/api/rooms');
      if (roomsRes.success && roomsRes.data?.rooms) {
        const available = roomsRes.data.rooms.map((r: any) => ({
          ...r,
          occupancy: r.current_occupants?.length || 0
        })).filter((r: Room) => r.occupancy < r.capacity);
        setAvailableRooms(available);
      }

      // Fetch my requests (we might need an endpoint, or just do a supabase query directly if no API)
      // Assuming GET /api/rooms/my-transfer-requests exists or we just use supabase.
      // The prompt does not define /api/rooms/my-transfer-requests so we can use Supabase.
      const { data: requestsData } = await supabase
        .from('room_transfer_requests')
        .select('id, rooms!requested_room_id(room_number), reason, status, created_at')
        .eq('student_id', session.user.id)
        .order('created_at', { ascending: false });

      if (requestsData) {
        setMyRequests(requestsData.map((r: any) => ({
          id: r.id,
          requested_room: r.rooms?.room_number || 'Unknown',
          reason: r.reason,
          status: r.status,
          created_at: r.created_at
        })));
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.length < 20 || !selectedRoomId) return;

    setSubmitting(true);
    setMessage('');
    const res = await apiPost('/api/rooms/transfer-request', {
      requested_room_id: selectedRoomId,
      reason
    });

    if (res.success) {
      setMessage('Request submitted. Warden will review it.');
      setReason('');
      setSelectedRoomId('');
      fetchData(); // Refresh list
    } else {
      setMessage('Failed to submit request.');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Room Transfer" showBack={true} onSignOut={handleSignOut} />

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-8">
          {/* Current Room Info */}
          <div className="border border-gray-100 rounded-xl p-6 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-900 mb-4">Current Room</h2>
            {currentRoom ? (
              <div>
                <div className="text-2xl font-medium text-gray-900 mb-1">{currentRoom.room_number}</div>
                <div className="text-xs text-gray-500 mb-4">{currentRoom.block_name}</div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Roommates: </span>
                  {currentRoom.roommates.length > 0 ? currentRoom.roommates.join(', ') : 'None'}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">You are not currently assigned to any room.</div>
            )}
          </div>

          {/* Transfer Request Form */}
          <div className="border border-gray-100 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-900 mb-4">Request a Transfer</h2>
            {message && (
              <div className="mb-4 p-3 bg-gray-50 text-gray-900 text-sm rounded-lg border border-gray-200">
                {message}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Select Requested Room</label>
                <select
                  value={selectedRoomId}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full bg-white"
                  required
                >
                  <option value="">Choose a room...</option>
                  {availableRooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.room_number} ({room.block_name}) - {room.capacity - room.occupancy} slots available
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reason (min 20 characters)</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Explain why you want to transfer..."
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full min-h-[100px]"
                  required
                  minLength={20}
                />
              </div>
              <button
                type="submit"
                disabled={submitting || reason.length < 20 || !selectedRoomId}
                className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>

          {/* My Requests */}
          <div>
            <h2 className="text-sm font-medium text-gray-900 mb-4">My Transfer Requests</h2>
            {myRequests.length === 0 ? (
              <div className="text-sm text-gray-500">No transfer requests found.</div>
            ) : (
              <div className="space-y-3">
                {myRequests.map(req => (
                  <div key={req.id} className="border border-gray-100 rounded-xl p-4 flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium text-gray-900 mb-1">Requested: {req.requested_room}</div>
                      <div className="text-xs text-gray-500 mb-2">"{req.reason}"</div>
                      <div className="text-[10px] text-gray-400">{new Date(req.created_at).toLocaleDateString()}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                      req.status === 'approved' ? 'bg-green-50 text-green-600' :
                      req.status === 'rejected' ? 'bg-red-50 text-red-600' :
                      'bg-yellow-50 text-yellow-600'
                    }`}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
