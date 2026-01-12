'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

type RoomApiItem = {
  id: string;
  room_number: string;
  block_name: string;
  capacity: number;
  current_occupants: { student_id: string; full_name: string }[] | null;
};

type TransferApiItem = {
  id: string;
  student_id: string;
  students: { profiles: { full_name: string } | null } | null;
  current_room: { room_number: string } | null;
  requested_room: { room_number: string } | null;
  reason: string;
  created_at: string;
};

type UnassignedApiItem = {
  id: string;
  roll_number: string;
  profiles: { full_name: string } | null;
};

const SkeletonCard = () => (
  <div className="border border-gray-100 rounded-xl p-6 animate-pulse">
    <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
    <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
    <div className="h-1.5 bg-gray-100 rounded-full w-full mt-4" />
  </div>
);

export default function WardenRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'rooms' | 'requests'>('rooms');
  const [mounted, setMounted] = useState(false);

  // Assign student inline form
  const [assignRoomId, setAssignRoomId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [unassignedStudents, setUnassignedStudents] = useState<UnassignedStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // Add Room form
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newBlockName, setNewBlockName] = useState('');
  const [newCapacity, setNewCapacity] = useState('4');
  const [addingRoom, setAddingRoom] = useState(false);
  const [addRoomError, setAddRoomError] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const { apiGet, apiPost, apiPatch } = useApi();
  const supabase = createClient();

  // Stable API refs to avoid re-render loops
  const apiGetRef = useRef(apiGet);
  const apiPostRef = useRef(apiPost);
  const apiPatchRef = useRef(apiPatch);
  useEffect(() => { apiGetRef.current = apiGet; });
  useEffect(() => { apiPostRef.current = apiPost; });
  useEffect(() => { apiPatchRef.current = apiPatch; });

  useEffect(() => { setMounted(true); }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const [roomsRes, requestsRes] = await Promise.all([
        apiGetRef.current('/api/rooms'),
        apiGetRef.current('/api/rooms/transfer-requests'),
      ]);

      if (roomsRes.success && roomsRes.data?.rooms) {
        setRooms(
          (roomsRes.data.rooms as RoomApiItem[]).map(r => ({
            id: r.id,
            room_number: r.room_number,
            block_name: r.block_name,
            capacity: r.capacity,
            occupancy: r.current_occupants?.length ?? 0,
            occupants:
              r.current_occupants?.map(o => ({
                id: o.student_id,
                name: o.full_name,
              })) ?? [],
          }))
        );
      } else if (roomsRes.success) {
        setRooms([]);
      }

      if (requestsRes.success && requestsRes.data) {
        setRequests(
          (requestsRes.data as TransferApiItem[]).map(r => ({
            id: r.id,
            student_id: r.student_id,
            student_name: r.students?.profiles?.full_name ?? 'Unknown',
            current_room: r.current_room?.room_number ?? 'Unknown',
            requested_room: r.requested_room?.room_number ?? 'Unknown',
            reason: r.reason,
            created_at: r.created_at,
          }))
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load rooms';
      if (msg.toLowerCase().includes('forbidden') || msg.includes('403')) {
        setIsForbidden(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssignClick = async (roomId: string) => {
    if (assignRoomId === roomId) {
      setAssignRoomId(null);
      return;
    }
    setAssignRoomId(roomId);
    setSearchQuery('');
    setSelectedStudentId('');

    const { data, error: sbErr } = await supabase
      .from('students')
      .select('id, roll_number, profiles!students_id_fkey(full_name)')
      .is('room_id', null);

    if (!sbErr && data) {
      setUnassignedStudents(
        (data as unknown as UnassignedApiItem[]).map(d => ({
          id: d.id,
          roll_number: d.roll_number,
          full_name: d.profiles?.full_name ?? 'Unknown',
        }))
      );
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedStudentId || !assignRoomId) return;
    setAssigning(true);
    try {
      const res = await apiPostRef.current('/api/rooms/assign', {
        student_id: selectedStudentId,
        room_id: assignRoomId,
      });
      if (res.success) {
        setAssignRoomId(null);
        fetchData();
      }
    } catch (err) {
      console.error('Assign error:', err);
    } finally {
      setAssigning(false);
    }
  };

  const handleTransfer = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await apiPatchRef.current(`/api/rooms/transfer-requests/${id}/${action}`, {});
      if (res.success) fetchData();
    } catch (err) {
      console.error('Transfer error:', err);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingRoom(true);
    setAddRoomError('');
    try {
      const { error: sbErr } = await supabase.from('rooms').insert({
        room_number: newRoomNumber.trim(),
        block_name: newBlockName.trim(),
        capacity: parseInt(newCapacity, 10),
      });
      if (sbErr) throw new Error(sbErr.message);
      setNewRoomNumber('');
      setNewBlockName('');
      setNewCapacity('4');
      setShowAddRoom(false);
      fetchData();
    } catch (err) {
      setAddRoomError(err instanceof Error ? err.message : 'Failed to add room');
    } finally {
      setAddingRoom(false);
    }
  };

  const filteredStudents = unassignedStudents.filter(
    s =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.occupancy >= r.capacity).length;
  const availableRooms = totalRooms - occupiedRooms;

  const formatDate = (dateString: string) =>
    mounted ? new Date(dateString).toLocaleDateString() : '—';

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Room Allocation" showBack={true} onSignOut={handleSignOut} />

      {/* Tabs */}
      <div className="flex gap-6 mb-8 border-b border-gray-100">
        <button
          onClick={() => setTab('rooms')}
          className={`text-sm font-medium pb-3 transition-colors ${
            tab === 'rooms'
              ? 'text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Room Grid
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`text-sm font-medium pb-3 flex items-center gap-2 transition-colors ${
            tab === 'requests'
              ? 'text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Transfer Requests
          {requests.length > 0 && (
            <span className="bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Error states */}
      {isForbidden && (
        <div className="border border-yellow-100 rounded-xl p-6 bg-yellow-50 mb-6">
          <div className="text-sm font-medium text-yellow-800 mb-1">Session expired</div>
          <div className="text-xs text-yellow-600 mb-4">
            Your warden session has expired. Please refresh to continue.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Refresh page
          </button>
        </div>
      )}

      {error && !isForbidden && (
        <div className="border border-red-100 rounded-xl p-4 bg-red-50 mb-6 flex items-center justify-between">
          <span className="text-sm text-red-600">{error}</span>
          <button
            onClick={fetchData}
            className="text-xs text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : tab === 'rooms' ? (
        <>
          {/* Stats + Add Room */}
          <div className="flex items-start justify-between mb-6">
            <div className="grid grid-cols-3 gap-4 flex-1 mr-4">
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Total</div>
                <div className="text-2xl font-medium text-gray-900">{totalRooms}</div>
              </div>
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Occupied</div>
                <div className="text-2xl font-medium text-gray-900">{occupiedRooms}</div>
              </div>
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Available</div>
                <div className="text-2xl font-medium text-gray-900">{availableRooms}</div>
              </div>
            </div>
            <button
              onClick={() => setShowAddRoom(v => !v)}
              className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors whitespace-nowrap"
            >
              {showAddRoom ? 'Cancel' : '+ Add Room'}
            </button>
          </div>

          {/* Add Room Form */}
          {showAddRoom && (
            <form
              onSubmit={handleAddRoom}
              className="border border-gray-100 rounded-xl p-6 mb-6 space-y-4"
            >
              <h2 className="text-sm font-medium text-gray-900">Add New Room</h2>
              {addRoomError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {addRoomError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Room Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A-101"
                    value={newRoomNumber}
                    onChange={e => setNewRoomNumber(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Block Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Block A"
                    value={newBlockName}
                    onChange={e => setNewBlockName(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Capacity</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10}
                    value={newCapacity}
                    onChange={e => setNewCapacity(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={addingRoom}
                className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {addingRoom ? 'Adding...' : 'Add Room'}
              </button>
            </form>
          )}

          {/* Empty state */}
          {rooms.length === 0 ? (
            <div className="border border-gray-100 rounded-xl p-12 text-center">
              <div className="text-sm font-medium text-gray-900 mb-1">No rooms configured yet</div>
              <div className="text-xs text-gray-400 mb-4">
                Add your first room using the button above.
              </div>
              <button
                onClick={() => setShowAddRoom(true)}
                className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                + Add Room
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {rooms.map(room => {
                const isFull = room.occupancy >= room.capacity;
                const isEmpty = room.occupancy === 0;

                return (
                  <div
                    key={room.id}
                    className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-lg font-medium text-gray-900">{room.room_number}</div>
                        <div className="text-xs text-gray-400">{room.block_name}</div>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                          isFull
                            ? 'bg-red-50 text-red-600'
                            : isEmpty
                            ? 'bg-green-50 text-green-600'
                            : 'bg-yellow-50 text-yellow-600'
                        }`}
                      >
                        {isFull ? 'Full' : isEmpty ? 'Available' : 'Partial'}
                      </span>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Occupancy</span>
                        <span>
                          {room.occupancy}/{room.capacity}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-900 rounded-full transition-all"
                          style={{
                            width: `${(room.occupancy / room.capacity) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mb-4 min-h-[40px]">
                      {room.occupants.length > 0 ? (
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
          )}
        </>
      ) : (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="border border-gray-100 rounded-xl p-12 text-center text-sm text-gray-400">
              No pending transfer requests.
            </div>
          ) : (
            requests.map(req => (
              <div
                key={req.id}
                className="border border-gray-100 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-300 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    {req.student_name}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {req.current_room} → {req.requested_room}
                  </div>
                  <div className="text-sm text-gray-600">"{req.reason}"</div>
                  <div className="text-xs text-gray-400 mt-2">{formatDate(req.created_at)}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
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
