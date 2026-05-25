/**
 * @file apps/client/app/(dashboard)/student/room-transfer/page.tsx
 * Student portal room-transfer dashboard subpage rendering status and actions.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { useApi } from '@/hooks/useApi';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { container } from '@/lib/ui';

const ORANGE = '#fb923c';

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

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '13px',
  color: 'rgba(255,255,255,0.85)',
  outline: 'none',
};

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '16px',
};

const STATUS_STYLES: Record<MyTransferRequest['status'], { color: string; bg: string; border: string }> = {
  pending: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' },
  approved: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)' },
  rejected: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
};

const SkeletonCard = () => (
  <div className="animate-pulse" style={{ ...panelStyle, padding: '24px' }}>
    <div style={{ height: '16px', width: '33%', marginBottom: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)' }} />
    <div style={{ height: '12px', width: '66%', marginBottom: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' }} />
    <div style={{ height: '12px', width: '50%', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' }} />
  </div>
);

export default function StudentRoomTransferPage() {
  const router = useRouter();
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired — please refresh');
        return;
      }

      // Run API calls and Supabase query in parallel
      const [myRoomRes, availableRoomsRes, requestsResult] = await Promise.all([
        apiGet('/api/v1/rooms/my'),
        apiGet('/api/v1/rooms/available'),
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
          (requestsResult.data as unknown as RequestRow[]).map((r) => ({
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
    if (reason.length < 20 || !selectedRoomId) {return;}

    setSubmitting(true);
    setMessage('');
    try {
      const res = await apiPost('/api/v1/rooms/transfer-request', {
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
    if (!mounted) {return '—';}
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <PageShell spotlight="rgba(251,146,60,0.12)">
      <PageHeader title="Room Transfer" showBack={true} onSignOut={handleSignOut} />

      <div style={container}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div style={{ ...panelStyle, padding: '24px', background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)' }}>
            <p className="text-red-500" style={{ fontSize: '13px', color: '#f87171', marginBottom: '14px' }}>{error}</p>
            <button
              type="button"
              onClick={fetchData}
              style={{ background: ORANGE, color: '#1a0f04', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Current Room Info */}
            <div style={{ ...panelStyle, padding: '24px' }}>
              <h2 style={sectionLabel}>Current Room</h2>
              {currentRoom ? (
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: '4px' }}>
                    {currentRoom.room_number}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>{currentRoom.block_name}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: '4px' }}>Roommates:</span>
                    {currentRoom.roommates.length > 0 ? currentRoom.roommates.join(', ') : 'None'}
                  </div>
                </div>
              ) : noRoomAssigned ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.25)', borderRadius: '12px' }}>
                  <svg
                    style={{ width: '20px', height: '20px', color: '#fbbf24', flexShrink: 0 }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#fbbf24' }}>No room assigned yet</div>
                    <div style={{ fontSize: '12px', color: 'rgba(251,191,36,0.7)', marginTop: '2px' }}>
                      Contact your warden to get a room assigned.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Loading room info...</div>
              )}
            </div>

            {/* Transfer Request Form */}
            <div style={{ ...panelStyle, padding: '24px' }}>
              <h2 style={sectionLabel}>Request a Transfer</h2>

              {message && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    borderRadius: '10px',
                    ...(messageType === 'success'
                      ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '0.5px solid rgba(74,222,128,0.25)' }
                      : { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '0.5px solid rgba(248,113,113,0.25)' }),
                  }}
                >
                  {message}
                </div>
              )}

              {availableRooms.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
                  No rooms with available capacity right now.
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Select Requested Room</label>
                    <select
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      className="hm-input"
                      style={{ ...inputStyle, colorScheme: 'dark' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(251,146,60,0.5)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                      required
                    >
                      <option value="">Choose a room...</option>
                      {availableRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.room_number} ({room.block_name}) — {room.capacity - room.occupancy}{' '}
                          slot{room.capacity - room.occupancy !== 1 ? 's' : ''} available
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                      Reason <span style={{ color: 'rgba(255,255,255,0.4)' }}>(min 20 characters)</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain why you want to transfer..."
                      className="hm-input"
                      style={{ ...inputStyle, minHeight: '100px', resize: 'none' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(251,146,60,0.5)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                      required
                      minLength={20}
                    />
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{reason.length}/20 minimum</div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || reason.length < 20 || !selectedRoomId}
                    style={{
                      alignSelf: 'flex-start',
                      background: ORANGE,
                      color: '#1a0f04',
                      borderRadius: '10px',
                      padding: '9px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: submitting || reason.length < 20 || !selectedRoomId ? 'not-allowed' : 'pointer',
                      opacity: submitting || reason.length < 20 || !selectedRoomId ? 0.4 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </form>
              )}
            </div>

            {/* My Requests */}
            <div>
              <h2 style={sectionLabel}>My Transfer Requests</h2>
              {myRequests.length === 0 ? (
                <div style={{ ...panelStyle, padding: '24px', fontSize: '13px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                  No transfer requests yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {myRequests.map((req) => {
                    const s = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
                    return (
                      <div
                        key={req.id}
                        className="glass-card"
                        style={{ ...panelStyle, padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                      >
                        <div style={{ flex: 1, minWidth: 0, marginRight: '16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: '4px' }}>
                            Room {req.requested_room}
                          </div>
                          <div className="line-clamp-2" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                            &quot;{req.reason}&quot;
                          </div>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{formatDate(req.created_at)}</div>
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: '999px',
                            color: s.color,
                            background: s.bg,
                            border: `0.5px solid ${s.border}`,
                          }}
                        >
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
