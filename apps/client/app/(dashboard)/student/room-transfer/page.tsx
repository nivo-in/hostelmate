'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useApi } from '@/hooks/useApi';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation'

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

const SkeletonCard = () => (
  <div className="border border-gray-100 rounded-xl p-6 animate-pulse">
    <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
    <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-1/2" />
  </div>
);

export default function StudentRoomTransferPage() {
  const router = useRouter()
  const [currentRoom, setCurrentRoom] = useState<CurrentRoomInfo | null>(null);
  const [noRoomAssigned, setNoRoomAssigned] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [myRequests, setMyRequests] = useState<MyTransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const { apiGet, apiPost } = useApi();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired — please refresh');
        return;
      }

      // Run API calls and Supabase query in parallel
      const [myRoomRes, availableRoomsRes, requestsResult] = await Promise.all([
        apiGet('/api/rooms/my'),
        apiGet('/api/rooms/available'),
        supabase
          .from('room_transfer_requests')
          .select('id, rooms!requested_room_id(room_number), reason, status, created_at')
          .eq('student_id', session.user.id)
          .order('created_at', { ascending: false }),
      ]);

      // Current room
      if (myRoomRes.success && myRoomRes.data?.student?.room_id) {
        const { student, roommates } = myRoomRes.data;
        setCurrentRoom({
          room_number: student.rooms?.room_number ?? 'Unknown',
          block_name: student.rooms?.block_name ?? '',
          roommates: roommates || [],
        });
        setNoRoomAssigned(false);
      } else {
        setCurrentRoom(null);
        setNoRoomAssigned(true);
      }

      // Available rooms
      if (availableRoomsRes.success) {
        setAvailableRooms(availableRoomsRes.data || []);
      }

      // My transfer requests
      if (requestsResult.data) {
        type RequestRow = {
          id: string;
          rooms: { room_number: string } | null;
          reason: string;
          status: 'pending' | 'approved' | 'rejected';
          created_at: string;
        };
        setMyRequests(
          (requestsResult.data as unknown as RequestRow[]).map(r => ({
            id: r.id,
            requested_room: r.rooms?.room_number ?? 'Unknown',
            reason: r.reason,
            status: r.status,
            created_at: r.created_at,
          }))
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Room transfer fetch error:', err);
      setError('Failed to load room data. Please try again.');
    } finally {
      setLoading(false);
    }
    }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.length < 20 || !selectedRoomId) return;

    setSubmitting(true);
    setMessage('');
    try {
      const res = await apiPost('/api/rooms/transfer-request', {
        requested_room_id: selectedRoomId,
        reason,
      });

      if (res.success) {
        setMessage('Request submitted. Warden will review it.');
        setMessageType('success');
        setReason('');
        setSelectedRoomId('');
        fetchData();
      } else {
        setMessage(res.error ?? 'Failed to submit request.');
        setMessageType('error');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Submit error:', err);
      setMessage('Failed to submit request. Please try again.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!mounted) return '—';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Room Transfer" showBack={true} onSignOut={handleSignOut} />

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <div className="border border-red-100 rounded-xl p-6 bg-red-50">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current Room Info */}
          <div className="border border-gray-100 rounded-xl p-6">
            <h2 className="text-xs uppercase text-gray-400 tracking-widest mb-4">Current Room</h2>
            {currentRoom ? (
              <div>
                <div className="text-2xl font-medium text-gray-900 mb-1">{currentRoom.room_number}</div>
                <div className="text-xs text-gray-400 mb-4">{currentRoom.block_name}</div>
                <div className="text-sm text-gray-600">
                  <span className="text-gray-400 mr-1">Roommates:</span>
                  {currentRoom.roommates.length > 0 ? currentRoom.roommates.join(', ') : 'None'}
                </div>
              </div>
            ) : noRoomAssigned ? (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="text-sm font-medium text-yellow-800">No room assigned yet</div>
                  <div className="text-xs text-yellow-600 mt-0.5">Contact your warden to get a room assigned.</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400">Loading room info...</div>
            )}
          </div>

          {/* Transfer Request Form */}
          <div className="border border-gray-100 rounded-xl p-6">
            <h2 className="text-xs uppercase text-gray-400 tracking-widest mb-4">Request a Transfer</h2>

            {message && (
              <div className={`mb-4 p-3 text-sm rounded-lg border ${
                messageType === 'success'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {message}
              </div>
            )}

            {availableRooms.length === 0 ? (
              <div className="text-sm text-gray-400">No rooms with available capacity right now.</div>
            ) : (
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
                        {room.room_number} ({room.block_name}) — {room.capacity - room.occupancy} slot{room.capacity - room.occupancy !== 1 ? 's' : ''} available
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Reason <span className="text-gray-400">(min 20 characters)</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Explain why you want to transfer..."
                    className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full min-h-[100px] resize-none"
                    required
                    minLength={20}
                  />
                  <div className="text-[10px] text-gray-400 mt-1">{reason.length}/20 minimum</div>
                </div>
                <button
                  type="submit"
                  disabled={submitting || reason.length < 20 || !selectedRoomId}
                  className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            )}
          </div>

          {/* My Requests */}
          <div>
            <h2 className="text-xs uppercase text-gray-400 tracking-widest mb-4">My Transfer Requests</h2>
            {myRequests.length === 0 ? (
              <div className="border border-gray-100 rounded-xl p-6 text-sm text-gray-400 text-center">
                No transfer requests yet.
              </div>
            ) : (
              <div className="space-y-3">
                {myRequests.map(req => (
                  <div key={req.id} className="border border-gray-100 rounded-xl p-4 flex justify-between items-start hover:border-gray-300 transition-colors">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="text-sm font-medium text-gray-900 mb-1">Room {req.requested_room}</div>
                      <div className="text-xs text-gray-500 mb-2 line-clamp-2">&quot;{req.reason}&quot;</div>
                      <div className="text-[10px] text-gray-400">{formatDate(req.created_at)}</div>
                    </div>
                    <span className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-full font-medium ${
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
