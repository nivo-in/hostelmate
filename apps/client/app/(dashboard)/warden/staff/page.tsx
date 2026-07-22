'use client';
import { Star, Users, BarChart, FolderArchive, X, Check } from 'lucide-react';

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { ui, panel, panelElevated, input, buttonPrimary, buttonGhost, container, label } from '@/lib/ui';

interface StaffMember {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  staff_role: string;
  is_present: boolean;
  created_at: string;
  isWarden?: boolean;
}

export default function StaffDirectory() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ── Main list state ──────────────────────────────────────────────────
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Modal state ──────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'add' | 'remove' | 'report'>('add');
  const { apiGet } = useApi();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  interface ReportData extends StaffMember {
    daysPresent: number;
    daysAbsent: number;
    attendancePercent: number;
    average_rating: number;
    total_reviews: number;
    this_month_reviews: number;
    hasData: boolean;
  }
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  // ── Add-staff form ───────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    staff_role: 'cleaner',
    email: '',
  });
  const [addMessage, setAddMessage] = useState('');
  const [addError, setAddError] = useState('');

  // ── Remove-staff inline confirm ──────────────────────────────────────
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────
  const fetchStaff = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const [{ data: staffMembers }, { data: wardenProfiles }, { data: todayAttendance }] =
        await Promise.all([
          supabase.from('staff_members').select('*').order('created_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('id, full_name, email, phone, role')
            .eq('role', 'warden'),
          supabase.from('staff_attendance').select('*').eq('date', today),
        ]);

      const wardens: StaffMember[] = (wardenProfiles || []).map((w) => {
        const attendanceRecord = todayAttendance?.find((a) => a.profile_id === w.id);
        return {
          id: w.id,
          full_name: w.full_name,
          email: w.email,
          phone: w.phone,
          staff_role: 'warden',
          is_present: attendanceRecord?.is_present ?? false,
          created_at: new Date().toISOString(),
          isWarden: true,
        };
      });

      const staffWithAttendance: StaffMember[] = (staffMembers || []).map((s) => {
        const attendanceRecord = todayAttendance?.find((a) => a.staff_id === s.id);
        return {
          ...s,
          is_present: attendanceRecord?.is_present ?? s.is_present,
        };
      });

      setStaffList([...wardens, ...staffWithAttendance]);
    } catch {
      setStaffList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (activeTab === 'report') {
      const fetchReport = async () => {
        setLoadingReport(true);
        try {
          let currentStaff = staffList;
          if (currentStaff.length === 0) {
            try {
              const [{ data: staffMembers }, { data: wardenProfiles }] = await Promise.all([
                supabase.from('staff_members').select('*').order('created_at', { ascending: false }),
                supabase.from('profiles').select('id, full_name, email, phone, role').eq('role', 'warden'),
              ]);
              const wardens: StaffMember[] = (wardenProfiles || []).map((w) => ({
                id: w.id,
                full_name: w.full_name,
                email: w.email,
                phone: w.phone,
                staff_role: 'warden',
                is_present: false,
                created_at: new Date().toISOString(),
                isWarden: true,
              }));
              const members: StaffMember[] = (staffMembers || []).map((s) => ({
                ...s,
                is_present: s.is_present ?? false,
              }));
              currentStaff = [...wardens, ...members];
            } catch {
              currentStaff = [];
            }
          }

          const targetMonth = selectedMonth || new Date().toISOString().slice(0, 7);
          const [yearStr, monthStr] = targetMonth.split('-');
          const year = parseInt(yearStr, 10) || new Date().getFullYear();
          const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
          const lastDayNum = new Date(year, month, 0).getDate();
          const startDate = `${targetMonth}-01`;
          const endDate = `${targetMonth}-${String(lastDayNum).padStart(2, '0')}`;

          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1; // 1-indexed (1..12)
          const currentDay = now.getDate(); // e.g. 22

          let totalDaysInPeriod = lastDayNum;
          if (year === currentYear && month === currentMonth) {
            totalDaysInPeriod = currentDay;
          } else if (year > currentYear || (year === currentYear && month > currentMonth)) {
            totalDaysInPeriod = 0;
          }

          const data = await Promise.all(
            currentStaff.map(async (staff) => {
              let attendance: { is_present: boolean }[] = [];
              try {
                let attendanceQuery = supabase
                  .from('staff_attendance')
                  .select('*')
                  .gte('date', startDate)
                  .lte('date', endDate);

                if (staff.isWarden) {
                  attendanceQuery = attendanceQuery.eq('profile_id', staff.id);
                } else {
                  attendanceQuery = attendanceQuery.eq('staff_id', staff.id);
                }

                const { data: attData } = await attendanceQuery;
                if (attData) {
                  attendance = attData;
                }
              } catch {
                /* fallback to empty array on RLS/query error */
              }

              const daysPresent = attendance.filter((a) => a.is_present).length;
              const daysAbsent = Math.max(0, totalDaysInPeriod - daysPresent);
              const attendancePercent =
                totalDaysInPeriod > 0
                  ? Math.min(100, Math.round((daysPresent / totalDaysInPeriod) * 100))
                  : 0;

              let feedbackData = { average_rating: 0, total_reviews: 0, this_month_reviews: 0 };

              if (!staff.isWarden) {
                try {
                  const res = await apiGet(`/api/v1/staff-feedback/${staff.id}`);
                  if (res && res.success && res.data) {
                    const allFeedback = res.data.feedback || [];
                    const thisMonthReviews = allFeedback.filter((f: { created_at?: string }) =>
                      f.created_at ? f.created_at.startsWith(targetMonth) : false
                    ).length;
                    feedbackData = {
                      average_rating: res.data.average_rating || 0,
                      total_reviews: res.data.total_reviews || 0,
                      this_month_reviews: thisMonthReviews,
                    };
                  }
                } catch {
                  /* fallback to default zero feedback */
                }
              }

              return {
                ...staff,
                daysPresent,
                daysAbsent,
                attendancePercent,
                ...feedbackData,
                hasData: true,
              };
            })
          );

          if (!isCancelled) {
            setReportData(data);
          }
        } catch {
          if (!isCancelled) {
            setReportData([]);
          }
        } finally {
          if (!isCancelled) {
            setLoadingReport(false);
          }
        }
      };
      fetchReport();
    }
    return () => {
      isCancelled = true;
    };
  }, [activeTab, selectedMonth]);

  // ── Sign out ─────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // ── Presence toggle ──────────────────────────────────────────────────
  const handleTogglePresence = async (id: string, currentStatus: boolean, isWarden?: boolean) => {
    const today = new Date().toISOString().split('T')[0];
    const newStatus = !currentStatus;

    // Optimistic update
    setStaffList((prev) => prev.map((s) => (s.id === id ? { ...s, is_present: newStatus } : s)));

    try {
      if (isWarden) {
        await supabase.from('staff_attendance').upsert(
          {
            profile_id: id,
            staff_type: 'warden',
            date: today,
            is_present: newStatus,
          },
          { onConflict: 'profile_id,date' }
        );
      } else {
        await supabase.from('staff_attendance').upsert(
          {
            staff_id: id,
            staff_type: 'staff_member',
            date: today,
            is_present: newStatus,
          },
          { onConflict: 'staff_id,date' }
        );

        // Also update staff_members table
        await supabase.from('staff_members').update({ is_present: newStatus }).eq('id', id);
      }
    } catch {
      // Revert optimistic update on failure
      setStaffList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_present: currentStatus } : s))
      );
    }
  };

  // ── Add staff ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddMessage('');

    try {
      const { error: insertError } = await supabase.from('staff_members').insert({
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email || null,
        staff_role: formData.staff_role,
        is_present: false,
      });

      if (insertError) {
        setAddError('Failed to add staff member.');
        return;
      }

      setAddMessage('Added successfully');
      setFormData({ full_name: '', phone: '', staff_role: 'cleaner', email: '' });
      setTimeout(() => setAddMessage(''), 3000);
      fetchStaff();
    } catch {
      setAddError('Failed to add staff member.');
    }
  };

  // ── Delete staff (modal only) ────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await supabase.from('staff_members').delete().eq('id', id);
    } catch {
      // Silently fail
    } finally {
      setConfirmingDeleteId(null);
      fetchStaff();
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────
  const getRoleVariant = (role: string): 'success' | 'danger' | 'warning' | 'info' | 'default' => {
    switch (role) {
      case 'warden':
        return 'info';
      case 'admin':
        return 'info';
      case 'cleaner':
        return 'success';
      case 'security':
        return 'warning';
      default:
        return 'default';
    }
  };

  const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

  const presentCount = staffList.filter((s) => s.is_present).length;
  const absentCount = staffList.filter((s) => !s.is_present).length;
  const totalCount = staffList.length;

  // staff_members only (for Remove tab)
  const deletableStaff = staffList.filter((s) => !s.isWarden);

  const tabBtn = (active: boolean): React.CSSProperties => ({
    paddingBottom: '10px',
    fontSize: '13px',
    fontWeight: 500,
    background: 'transparent',
    border: 'none',
    borderBottom: active ? `2px solid ${ui.accent}` : '2px solid transparent',
    color: active ? ui.text : ui.textMuted,
    cursor: 'pointer',
    transition: 'color 0.2s',
  });

  return (
    <PageShell>
      <PageHeader title="Staff Directory" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <div style={{ ...panelElevated, padding: '16px 18px' }}>
            <p style={{ ...label, margin: '0 0 8px' }}>Present Today</p>
            <p style={{ fontSize: '26px', fontWeight: 500, color: ui.green, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{presentCount}</p>
          </div>
          <div style={{ ...panelElevated, padding: '16px 18px' }}>
            <p style={{ ...label, margin: '0 0 8px' }}>Absent Today</p>
            <p style={{ fontSize: '26px', fontWeight: 500, color: ui.red, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{absentCount}</p>
          </div>
          <div style={{ ...panelElevated, padding: '16px 18px' }}>
            <p style={{ ...label, margin: '0 0 8px' }}>Total Staff</p>
            <p style={{ fontSize: '26px', fontWeight: 500, color: ui.text, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{totalCount}</p>
          </div>
        </div>

        {/* ── Staff list header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: ui.text, margin: 0 }}>Staff Members</h2>
          <button
            onClick={() => {
              setModalOpen(true);
              setActiveTab('add');
            }}
            className="btn-primary"
            style={buttonPrimary}
          >
            Manage Staff
          </button>
        </div>

        {/* ── Staff list ── */}
        {loading ? (
          <LoadingSpinner />
        ) : staffList.length === 0 ? (
          <EmptyState message="No staff members added yet." icon={<Users strokeWidth={1.5} />} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {staffList.map((staff) => (
              <div
                key={staff.id}
                className="glass-card"
                style={{ ...panel, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', flex: 1, marginRight: '16px', alignItems: 'center', minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: ui.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.full_name}</p>
                  <div style={{ width: 'fit-content' }}>
                    <Badge variant={getRoleVariant(staff.staff_role)}>{roleLabel(staff.staff_role)}</Badge>
                  </div>
                  <p style={{ fontSize: '13px', color: ui.textMuted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.phone || '—'}</p>
                  <p style={{ fontSize: '13px', color: ui.textMuted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.email || '—'}</p>
                </div>
                <button
                  onClick={() => handleTogglePresence(staff.id, staff.is_present, staff.isWarden)}
                  style={{
                    flexShrink: 0,
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '5px 12px',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: staff.is_present ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                    border: staff.is_present ? '0.5px solid rgba(74,222,128,0.25)' : '0.5px solid rgba(248,113,113,0.25)',
                    color: staff.is_present ? ui.green : ui.red,
                  }}
                >
                  {staff.is_present ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={14} strokeWidth={2.5} />Present</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><X size={14} strokeWidth={2.5} />Absent</span>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Manage Staff Modal ── */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {setModalOpen(false);}
          }}
        >
          <div
            style={{
              background: '#14141f',
              border: ui.borderStrong,
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '512px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 500, color: ui.text, margin: 0 }}>Manage Staff</h3>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: ui.textMuted, cursor: 'pointer', display: 'flex', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = ui.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = ui.textMuted)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '24px', borderBottom: ui.border, marginBottom: '20px' }}>
              <button onClick={() => setActiveTab('add')} style={tabBtn(activeTab === 'add')}>
                Add Staff
              </button>
              <button
                onClick={() => {
                  setActiveTab('remove');
                  setConfirmingDeleteId(null);
                }}
                style={tabBtn(activeTab === 'remove')}
              >
                Remove Staff
              </button>
              <button onClick={() => setActiveTab('report')} style={tabBtn(activeTab === 'report')}>
                Monthly Report
              </button>
            </div>

            {/* ── Tab: Add Staff ── */}
            {activeTab === 'add' && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {addMessage && <p style={{ fontSize: '12px', color: ui.green, fontWeight: 500, margin: 0 }}>{addMessage}</p>}
                {addError && <p style={{ fontSize: '12px', color: ui.red, margin: 0 }}>{addError}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={{ ...label, display: 'block' }}>Full Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      className="hm-input"
                      style={input}
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ ...label, display: 'block' }}>Phone</label>
                    <input
                      required
                      type="tel"
                      placeholder="e.g. 9876543210"
                      className="hm-input"
                      style={input}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ ...label, display: 'block' }}>
                      Email <span style={{ color: ui.textFaint }}>(optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. ramesh@hostel.in"
                      className="hm-input"
                      style={input}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ ...label, display: 'block' }}>Role</label>
                    <select
                      className="hm-input"
                      style={{ ...input, colorScheme: 'dark' }}
                      value={formData.staff_role}
                      onChange={(e) => setFormData({ ...formData, staff_role: e.target.value })}
                    >
                      <option value="warden">Warden</option>
                      <option value="admin">Admin</option>
                      <option value="cleaner">Cleaner</option>
                      <option value="security">Security</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary" style={{ ...buttonPrimary, width: '100%', marginTop: '4px' }}>
                  Add Staff Member
                </button>
              </form>
            )}

            {/* ── Tab: Remove Staff ── */}
            {activeTab === 'remove' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '288px', overflowY: 'auto' }}>
                {deletableStaff.length === 0 ? (
                  <EmptyState message="No removable staff members." icon={<FolderArchive strokeWidth={1.5} />} />
                ) : (
                  deletableStaff.map((staff) => (
                    <div key={staff.id} style={{ ...panel, padding: '12px 14px' }}>
                      {confirmingDeleteId === staff.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: '13px', color: ui.textSoft, margin: 0 }}>
                            Remove <span style={{ fontWeight: 500, color: ui.text }}>{staff.full_name}</span>?
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="btn-ghost"
                              style={{ ...buttonGhost, padding: '6px 12px', fontSize: '12px' }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(staff.id)}
                              style={{
                                background: 'rgba(248,113,113,0.15)',
                                border: '0.5px solid rgba(248,113,113,0.3)',
                                color: ui.red,
                                borderRadius: ui.radiusXs,
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.25)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.15)')}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: ui.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {staff.full_name}
                            </p>
                            <div style={{ flexShrink: 0 }}>
                              <Badge variant={getRoleVariant(staff.staff_role)}>{roleLabel(staff.staff_role)}</Badge>
                            </div>
                          </div>
                          <button
                            onClick={() => setConfirmingDeleteId(staff.id)}
                            style={{ flexShrink: 0, padding: '6px', background: 'transparent', border: 'none', color: ui.textMuted, borderRadius: '8px', cursor: 'pointer', transition: 'color 0.2s', display: 'flex' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = ui.red)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = ui.textMuted)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Tab: Monthly Report ── */}
            {activeTab === 'report' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '384px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ ...label, margin: 0 }}>Report Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="hm-input"
                    style={{ ...input, width: 'auto', colorScheme: 'dark' }}
                  />
                </div>

                {loadingReport ? (
                  <LoadingSpinner />
                ) : reportData.length === 0 ? (
                  <EmptyState message="No staff members found." icon={<BarChart strokeWidth={1.5} />} />
                ) : (
                  reportData.map((staff) => (
                    <div key={staff.id} style={{ ...panel, padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: ui.text, margin: 0 }}>{staff.full_name}</p>
                          <Badge variant={getRoleVariant(staff.staff_role)}>{roleLabel(staff.staff_role)}</Badge>
                        </div>
                        <span style={{ fontSize: '11px', color: staff.is_present ? ui.green : ui.red, fontWeight: 500 }}>
                          Today: {staff.is_present ? 'Present' : 'Absent'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13px' }}>
                        <div>
                          <p style={{ ...label, margin: '0 0 6px' }}>
                            Attendance (
                            {(() => {
                              try {
                                const [y, mon] = selectedMonth.split('-');
                                const date = new Date(parseInt(y, 10), parseInt(mon, 10) - 1, 1);
                                return date.toLocaleString('default', { month: 'long', year: 'numeric' });
                              } catch {
                                return selectedMonth;
                              }
                            })()}
                            )
                          </p>
                          <p style={{ color: ui.textSoft, margin: 0 }}>Days Present: <strong style={{ color: ui.green }}>{staff.daysPresent}</strong></p>
                          <p style={{ color: ui.textSoft, margin: 0 }}>Days Absent: <strong style={{ color: ui.red }}>{staff.daysAbsent}</strong></p>
                          <p style={{ color: ui.text, fontWeight: 500, margin: '4px 0 0' }}>
                            Attendance Rate: {staff.attendancePercent}%
                          </p>
                        </div>
                        <div>
                          <p style={{ ...label, margin: '0 0 6px' }}>Performance & Rating</p>
                          <p style={{ color: ui.text, display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontWeight: 500 }}>
                            {Number(staff.average_rating || 0).toFixed(1)}{' '}
                            <span style={{ color: ui.amber }}><Star size={15} strokeWidth={1.5} /></span>
                          </p>
                          <p style={{ color: ui.textMuted, fontSize: '11px', margin: '4px 0 0' }}>
                            {staff.total_reviews} total reviews
                          </p>
                          <p style={{ color: ui.textMuted, fontSize: '11px', margin: 0 }}>
                            {staff.this_month_reviews} reviews this month
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
