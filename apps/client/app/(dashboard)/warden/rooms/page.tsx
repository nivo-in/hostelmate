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
  occupants: { id: string; name: string }[];
};

type TransferRequest = {
  id: string;
  student_id: string;
  student_name: string;
  current_room: string;
  requested_room: string;
  reason: string;
  created_at: string;
};

type UnassignedStudent = {
  id: string;
  roll_number: string;
  full_name: string;
};

export default function WardenRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'rooms' | 'requests'>('rooms');

  // Inline form state
  const [assignRoomId, setAssignRoomId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [unassignedStudents, setUnassignedStudents] = useState<UnassignedStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const { apiGet, apiPost, apiPatch } = useApi();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [roomsRes, requestsRes] = await Promise.all([
        apiGet('/api/rooms'),
        apiGet('/api/rooms/transfer-requests')
      ]);

      if (roomsRes.success && roomsRes.data?.rooms) {
        setRooms(roomsRes.data.rooms.map((r: any) => ({
          ...r,
          occupancy: r.current_occupants?.length || 0,
          occupants: r.current_occupants?.map((o: any) => ({ id: o.student_id, name: o.full_name })) || []
        })));
      }
      
      if (requestsRes.success && requestsRes.data) {
        setRequests(requestsRes.data.map((r: any) => ({
          id: r.id,
          student_id: r.student_id,
          student_name: r.students?.profiles?.full_name || 'Unknown',
          current_room: r.current_room?.room_number || 'Unknown',
          requested_room: r.requested_room?.room_number || 'Unknown',
          reason: r.reason,
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

  const handleAssignClick = async (roomId: string) => {
    if (assignRoomId === roomId) {
      setAssignRoomId(null);
      return;
    }
    setAssignRoomId(roomId);
    setSearchQuery('');
    setSelectedStudentId('');
    
    // Fetch unassigned students directly
    const { data, error } = await supabase
      .from('students')
      .select('id, roll_number, profiles!students_id_fkey(full_name)')
      .is('room_id', null);

    if (!error && data) {
      const formatted = data.map((d: any) => ({
        id: d.id,
        roll_number: d.roll_number,
        full_name: d.profiles?.full_name || 'Unknown'
      }));
      setUnassignedStudents(formatted);
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedStudentId || !assignRoomId) return;
    setAssigning(true);
    const res = await apiPost('/api/rooms/assign', { student_id: selectedStudentId, room_id: assignRoomId });
    if (res.success) {
      setAssignRoomId(null);
      fetchData();
    }
    setAssigning(false);
  };

  const handleTransfer = async (id: string, action: 'approve' | 'reject') => {
    const res = await apiPatch(`/api/rooms/transfer-requests/${id}/${action}`, {});
    if (res.success) {
      fetchData();
    }
  };

  const filteredStudents = unassignedStudents.filter(s => 
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.occupancy >= r.capacity).length;
  const availableRooms = totalRooms - occupiedRooms;

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Room Allocation" showBack={true} onSignOut={handleSignOut} />

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-gray-100 pb-2">
        <button
          onClick={() => setTab('rooms')}
          className={`text-sm font-medium pb-2 ${tab === 'rooms' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Room Grid
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`text-sm font-medium pb-2 flex items-center gap-2 ${tab === 'requests' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Transfer Requests
          {requests.length > 0 && (
            <span className="bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : tab === 'rooms' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="border border-gray-100 rounded-xl p-6">
              <div className="text-xs text-gray-400 mb-1">Total Rooms</div>
              <div className="text-2xl font-medium text-gray-900">{totalRooms}</div>
            </div>
            <div className="border border-gray-100 rounded-xl p-6">
              <div className="text-xs text-gray-400 mb-1">Occupied Rooms</div>
              <div className="text-2xl font-medium text-gray-900">{occupiedRooms}</div>
            </div>
            <div className="border border-gray-100 rounded-xl p-6">
              <div className="text-xs text-gray-400 mb-1">Available Rooms</div>
              <div className="text-2xl font-medium text-gray-900">{availableRooms}</div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rooms.map(room => {
              const isFull = room.occupancy >= room.capacity;
              const isEmpty = room.occupancy === 0;
              const isPartial = !isFull && !isEmpty;

              return (
                <div key={room.id} className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-lg font-medium text-gray-900">{room.room_number}</div>
                      <div className="text-xs text-gray-400">{room.block_name}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                      isFull ? 'bg-red-50 text-red-600' :
                      isEmpty ? 'bg-green-50 text-green-600' :
                      'bg-yellow-50 text-yellow-600'
                    }`}>
                      {isFull ? 'Full' : isEmpty ? 'Available' : 'Partial'}
                    </span>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Occupancy</span>
                      <span>{room.occupancy}/{room.capacity}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gray-900 rounded-full transition-all" 
                        style={{ width: `${(room.occupancy / room.capacity) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="mb-4 min-h-[40px]">
                    {room.occupants && room.occupants.length > 0 ? (
                      <ul className="text-sm text-gray-600 space-y-1">
                        {room.occupants.map(occ => (
                          <li key={occ.id}>• {occ.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-sm text-gray-400 italic">No occupants</span>
                    )}
                  </div>

                  {!isFull && (
                    <button
                      onClick={() => handleAssignClick(room.id)}
                      className="w-full border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      {assignRoomId === room.id ? 'Cancel' : 'Assign Student'}
                    </button>
                  )}

                  {assignRoomId === room.id && !isFull && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <input
                        type="text"
                        placeholder="Search student..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-500 w-full mb-2"
                      />
                      <select
                        value={selectedStudentId}
                        onChange={e => setSelectedStudentId(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-500 w-full mb-3 bg-white"
                      >
                        <option value="">Select student...</option>
                        {filteredStudents.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} ({s.roll_number})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAssignSubmit}
                        disabled={!selectedStudentId || assigning}
                        className="w-full bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {assigning ? 'Assigning...' : 'Confirm Assign'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="text-sm text-gray-500">No pending transfer requests.</div>
          ) : (
            requests.map(req => (
              <div key={req.id} className="border border-gray-100 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-900 mb-1">{req.student_name}</div>
                  <div className="text-xs text-gray-500 mb-2">
                    {req.current_room} → {req.requested_room}
                  </div>
                  <div className="text-sm text-gray-600">"{req.reason}"</div>
                  <div className="text-xs text-gray-400 mt-2">{new Date(req.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTransfer(req.id, 'approve')}
                    className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleTransfer(req.id, 'reject')}
                    className="border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
