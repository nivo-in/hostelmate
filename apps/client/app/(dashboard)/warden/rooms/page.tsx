/**
 * @file apps/client/app/(dashboard)/warden/rooms/page.tsx
 * Warden portal rooms administrative page rendering statistics and actions.
 */

'use client';
import { Home, RefreshCcw } from 'lucide-react';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi } from '@/hooks/useApi';
import { createClient } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { ui, panel, panelElevated, input, buttonPrimary, buttonGhost, container, label } from '@/lib/ui';

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

// --- Fuzzy Search Helpers ---
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) {return b.length;}
  if (b.length === 0) {return a.length;}
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) {matrix[0][i] = i;}
  for (let j = 0; j <= b.length; j++) {matrix[j][0] = j;}
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyMatch(query: string, target: string, maxDistance: number = 2): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();

  if (!q) {return true;}
  if (t.includes(q)) {return true;}

  const words = t.split(/[\s-]+/);
  for (const word of words) {
    if (Math.abs(word.length - q.length) <= maxDistance) {
      if (levenshteinDistance(q, word) <= maxDistance) {
        return true;
      }
    }
  }
  return false;
}
// ----------------------------

const SkeletonCard = () => (
  <div style={{ ...panel, padding: '22px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', animation: 'hmPulse 1.4s ease-in-out infinite' }}>
      <div style={{ height: '16px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '33%' }} />
      <div style={{ height: '12px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '66%' }} />
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', width: '100%', marginTop: '8px' }} />
    </div>
    <style>{`@keyframes hmPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
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
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
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
  useEffect(() => {
    apiGetRef.current = apiGet;
  });
  useEffect(() => {
    apiPostRef.current = apiPost;
  });
  useEffect(() => {
    apiPatchRef.current = apiPatch;
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign('/login');
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const [roomsRes, requestsRes] = await Promise.all([
        apiGetRef.current('/api/v1/rooms'),
        apiGetRef.current('/api/v1/rooms/transfer-requests'),
      ]);

      if (roomsRes.success && roomsRes.data?.rooms) {
        setRooms(
          (roomsRes.data.rooms as RoomApiItem[]).map((r) => ({
            id: r.id,
            room_number: r.room_number,
            block_name: r.block_name,
            capacity: r.capacity,
            occupancy: r.current_occupants?.length ?? 0,
            occupants:
              r.current_occupants?.map((o) => ({
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
          (requestsRes.data as TransferApiItem[]).map((r) => ({
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

    try {
      const res = await apiGetRef.current('/api/v1/rooms/unassigned');
      if (res.success && res.data) {
        setUnassignedStudents(res.data);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch unassigned students:', err);
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedStudentId || !assignRoomId) {return;}
    setAssigning(true);
    try {
      const res = await apiPostRef.current('/api/v1/rooms/assign', {
        student_id: selectedStudentId,
        room_id: assignRoomId,
      });
      if (res.success) {
        setAssignRoomId(null);
        fetchData();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Assign error:', err);
    } finally {
      setAssigning(false);
    }
  };

  const handleTransfer = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await apiPatchRef.current(`/api/v1/rooms/transfer-requests/${id}/${action}`, {});
      if (res.success) {fetchData();}
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Transfer error:', err);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingRoom(true);
    setAddRoomError('');
    try {
      const res = await apiPostRef.current('/api/v1/rooms', {
        room_number: newRoomNumber,
        block_name: newBlockName,
        capacity: newCapacity,
      });

      if (!res.success) {
        throw new Error('Failed to create room');
      }

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
    (s) =>
      fuzzyMatch(debouncedSearchQuery, s.full_name) ||
      fuzzyMatch(debouncedSearchQuery, s.roll_number)
  );

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => r.occupancy >= r.capacity).length;
  const availableRooms = totalRooms - occupiedRooms;

  const formatDate = (dateString: string) =>
    mounted ? new Date(dateString).toLocaleDateString() : '—';

  const tabBtn = (active: boolean): React.CSSProperties => ({
    paddingBottom: '12px',
    fontSize: '13px',
    fontWeight: 500,
    background: 'transparent',
    border: 'none',
    borderBottom: active ? `2px solid ${ui.accent}` : '2px solid transparent',
    color: active ? ui.text : ui.textMuted,
    cursor: 'pointer',
    transition: 'color 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  return (
    <PageShell>
      <PageHeader title="Room Allocation" showBack={true} onSignOut={handleSignOut} />

      <div style={container}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: ui.border }}>
          <button onClick={() => setTab('rooms')} style={tabBtn(tab === 'rooms')}>
            Room Grid
          </button>
          <button onClick={() => setTab('requests')} style={tabBtn(tab === 'requests')}>
            Transfer Requests
            {requests.length > 0 && (
              <span style={{ background: ui.accent, color: '#fff', fontSize: '10px', padding: '1px 7px', borderRadius: '9999px', fontWeight: 600 }}>
                {requests.length}
              </span>
            )}
          </button>
        </div>

        {/* Error states */}
        {isForbidden && (
          <div style={{ background: 'rgba(251,191,36,0.1)', border: '0.5px solid rgba(251,191,36,0.25)', borderRadius: ui.radius, padding: '22px', marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: ui.amber, marginBottom: '4px' }}>Session expired</div>
            <div style={{ fontSize: '12px', color: ui.textMuted, marginBottom: '16px' }}>
              Your warden session has expired. Please refresh to continue.
            </div>
            <button onClick={() => window.location.reload()} className="btn-primary" style={buttonPrimary}>
              Refresh page
            </button>
          </div>
        )}

        {error && !isForbidden && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.25)', borderRadius: ui.radius, padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: ui.red }}>{error}</span>
            <button onClick={fetchData} style={{ fontSize: '12px', color: ui.red, background: 'transparent', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="rooms-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : tab === 'rooms' ? (
          <>
            {/* Stats + Add Room */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', flex: 1, marginRight: '16px' }}>
                <div style={{ ...panelElevated, padding: '16px 18px' }}>
                  <div style={{ ...label, marginBottom: '8px' }}>Total</div>
                  <div style={{ fontSize: '26px', fontWeight: 500, color: ui.text, fontVariantNumeric: 'tabular-nums' }}>{totalRooms}</div>
                </div>
                <div style={{ ...panelElevated, padding: '16px 18px' }}>
                  <div style={{ ...label, marginBottom: '8px' }}>Occupied</div>
                  <div style={{ fontSize: '26px', fontWeight: 500, color: ui.amber, fontVariantNumeric: 'tabular-nums' }}>{occupiedRooms}</div>
                </div>
                <div style={{ ...panelElevated, padding: '16px 18px' }}>
                  <div style={{ ...label, marginBottom: '8px' }}>Available</div>
                  <div style={{ fontSize: '26px', fontWeight: 500, color: ui.green, fontVariantNumeric: 'tabular-nums' }}>{availableRooms}</div>
                </div>
              </div>
              <button onClick={() => setShowAddRoom((v) => !v)} className="btn-primary" style={{ ...buttonPrimary, whiteSpace: 'nowrap' }}>
                {showAddRoom ? 'Cancel' : '+ Add Room'}
              </button>
            </div>

            {/* Add Room Form */}
            {showAddRoom && (
              <form onSubmit={handleAddRoom} style={{ ...panel, padding: '22px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 style={{ fontSize: '13px', fontWeight: 500, color: ui.text, margin: 0 }}>Add New Room</h2>
                {addRoomError && (
                  <div style={{ fontSize: '12px', color: ui.red, background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.25)', borderRadius: ui.radiusXs, padding: '8px 12px' }}>
                    {addRoomError}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="room-form-grid">
                  <div>
                    <label style={{ ...label, display: 'block' }}>Room Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. A-101"
                      value={newRoomNumber}
                      onChange={(e) => setNewRoomNumber(e.target.value)}
                      className="hm-input"
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={{ ...label, display: 'block' }}>Block Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Block A"
                      value={newBlockName}
                      onChange={(e) => setNewBlockName(e.target.value)}
                      className="hm-input"
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={{ ...label, display: 'block' }}>Capacity</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={10}
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(e.target.value)}
                      className="hm-input"
                      style={input}
                    />
                  </div>
                </div>
                <button type="submit" disabled={addingRoom} className="btn-primary" style={{ ...buttonPrimary, alignSelf: 'flex-start', opacity: addingRoom ? 0.5 : 1 }}>
                  {addingRoom ? 'Adding...' : 'Add Room'}
                </button>
              </form>
            )}

            {/* Empty state */}
            {rooms.length === 0 ? (
              <div style={{ ...panel, padding: '12px' }}>
                <EmptyState message="No rooms configured yet. Add your first room using the button above." icon={<Home strokeWidth={1.5} />} />
                <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '32px' }}>
                  <button onClick={() => setShowAddRoom(true)} className="btn-primary" style={buttonPrimary}>
                    + Add Room
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="rooms-grid">
                {rooms.map((room) => {
                  const isFull = room.occupancy >= room.capacity;
                  const isEmpty = room.occupancy === 0;
                  const statusVariant = isFull ? 'danger' : isEmpty ? 'success' : 'warning';
                  const barColor = isFull ? ui.red : isEmpty ? ui.green : ui.amber;

                  return (
                    <div key={room.id} className="glass-card" style={{ ...panel, padding: '22px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                          <div style={{ fontSize: '17px', fontWeight: 500, color: ui.text }}>{room.room_number}</div>
                          <div style={{ fontSize: '12px', color: ui.textMuted }}>{room.block_name}</div>
                        </div>
                        <Badge variant={statusVariant}>{isFull ? 'Full' : isEmpty ? 'Available' : 'Partial'}</Badge>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: ui.textMuted, marginBottom: '6px' }}>
                          <span>Occupancy</span>
                          <span>
                            {room.occupancy}/{room.capacity}
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              background: barColor,
                              borderRadius: '9999px',
                              transition: 'all 0.3s',
                              width: `${(room.occupancy / room.capacity) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px', minHeight: '40px' }}>
                        {room.occupants.length > 0 ? (
                          <ul style={{ fontSize: '13px', color: ui.textSoft, margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {room.occupants.map((occ) => (
                              <li key={occ.id}>• {occ.name}</li>
                            ))}
                          </ul>
                        ) : (
                          <span style={{ fontSize: '13px', color: ui.textMuted, fontStyle: 'italic' }}>No occupants</span>
                        )}
                      </div>

                      {!isFull && (
                        <button onClick={() => handleAssignClick(room.id)} className="btn-ghost" style={{ ...buttonGhost, width: '100%' }}>
                          {assignRoomId === room.id ? 'Cancel' : 'Assign Student'}
                        </button>
                      )}

                      {assignRoomId === room.id && !isFull && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: ui.border }}>
                          <input
                            type="text"
                            placeholder="Search student..."
                            value={searchQuery}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSearchQuery(val);

                              // Automatically select the first match when searching
                              if (val.trim() !== '') {
                                const matches = unassignedStudents.filter(
                                  (s) =>
                                    fuzzyMatch(val, s.full_name) || fuzzyMatch(val, s.roll_number)
                                );
                                if (matches.length > 0) {
                                  setSelectedStudentId(matches[0].id);
                                } else {
                                  setSelectedStudentId('');
                                }
                              }
                            }}
                            className="hm-input"
                            style={{ ...input, marginBottom: '8px' }}
                          />
                          <select
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            className="hm-input"
                            style={{ ...input, colorScheme: 'dark', marginBottom: '12px' }}
                          >
                            <option value="">Select student...</option>
                            {filteredStudents.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.full_name} ({s.roll_number})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={handleAssignSubmit}
                            disabled={!selectedStudentId || assigning}
                            className="btn-primary"
                            style={{ ...buttonPrimary, width: '100%', opacity: !selectedStudentId || assigning ? 0.5 : 1 }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requests.length === 0 ? (
              <div style={{ ...panel, overflow: 'hidden' }}>
                <EmptyState message="No pending transfer requests." icon={<RefreshCcw strokeWidth={1.5} />} />
              </div>
            ) : (
              requests.map((req) => (
                <div key={req.id} className="glass-card" style={{ ...panel, padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: ui.text, marginBottom: '4px' }}>{req.student_name}</div>
                      <div style={{ fontSize: '12px', color: ui.textMuted, marginBottom: '8px' }}>
                        {req.current_room} → {req.requested_room}
                      </div>
                      <div style={{ fontSize: '13px', color: ui.textSoft }}>&quot;{req.reason}&quot;</div>
                      <div style={{ fontSize: '12px', color: ui.textMuted, marginTop: '8px' }}>{formatDate(req.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button onClick={() => handleTransfer(req.id, 'approve')} className="btn-primary" style={buttonPrimary}>
                        Approve
                      </button>
                      <button onClick={() => handleTransfer(req.id, 'reject')} className="btn-ghost" style={buttonGhost}>
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 860px) {
          .rooms-grid { grid-template-columns: 1fr !important; }
          .room-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PageShell>
  );
}
