'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/useApi'

interface StaffMember {
  id: string
  full_name: string
  email?: string
  phone?: string
  staff_role: string
  is_present: boolean
  created_at: string
  isWarden?: boolean
}

export default function StaffDirectory() {
  const router = useRouter()
  const supabase = createClient()

  // ── Main list state ──────────────────────────────────────────────────
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  // ── Modal state ──────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'add' | 'remove' | 'report'>('add')
  const { apiGet } = useApi()
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  interface ReportData extends StaffMember {
  daysPresent: number
  daysAbsent: number
  attendancePercent: number
  average_rating: number
  total_reviews: number
  this_month_reviews: number
  hasData: boolean
}
const [reportData, setReportData] = useState<ReportData[]>([])
  const [loadingReport, setLoadingReport] = useState(false)

  // ── Add-staff form ───────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    staff_role: 'cleaner',
    email: ''
  })
  const [addMessage, setAddMessage] = useState('')
  const [addError, setAddError] = useState('')

  // ── Remove-staff inline confirm ──────────────────────────────────────
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  // ── Data fetching ────────────────────────────────────────────────────
  const fetchStaff = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    try {
      const [
        { data: staffMembers },
        { data: wardenProfiles },
        { data: todayAttendance }
      ] = await Promise.all([
        supabase.from('staff_members').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, phone, role').eq('role', 'warden'),
        supabase.from('staff_attendance').select('*').eq('date', today)
      ])

      const wardens: StaffMember[] = (wardenProfiles || []).map(w => {
        const attendanceRecord = todayAttendance?.find(a => a.profile_id === w.id)
        return {
          id: w.id,
          full_name: w.full_name,
          email: w.email,
          phone: w.phone,
          staff_role: 'warden',
          is_present: attendanceRecord?.is_present ?? false,
          created_at: new Date().toISOString(),
          isWarden: true
        }
      })

      const staffWithAttendance: StaffMember[] = (staffMembers || []).map(s => {
        const attendanceRecord = todayAttendance?.find(a => a.staff_id === s.id)
        return {
          ...s,
          is_present: attendanceRecord?.is_present ?? s.is_present
        }
      })

      setStaffList([...wardens, ...staffWithAttendance])
    } catch {
      setStaffList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  useEffect(() => {
    if (activeTab === 'report') {
      const fetchReport = async () => {
        setLoadingReport(true)
        const staffToReport = staffList.filter(s => !s.isWarden)
        
        try {
          const data = await Promise.all(staffToReport.map(async (staff) => {
            const { data: attendance } = await supabase
              .from('staff_attendance')
              .select('*')
              .eq('staff_id', staff.id)
              .gte('date', `${selectedMonth}-01`)
              .lte('date', `${selectedMonth}-31`)
              
            const daysPresent = attendance?.filter(a => a.is_present).length || 0
            const daysAbsent = attendance?.filter(a => !a.is_present).length || 0
            const totalDays = daysPresent + daysAbsent
            const attendancePercent = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0

            const res = await apiGet(`/api/staff-feedback/${staff.id}`)
            let feedbackData = { average_rating: 0, total_reviews: 0, this_month_reviews: 0 }
            
            if (res.success && res.data) {
              const allFeedback = res.data.feedback || []
              const thisMonthReviews = allFeedback.filter((f: { created_at: string }) => f.created_at.startsWith(selectedMonth)).length
              feedbackData = {
                average_rating: res.data.average_rating || 0,
                total_reviews: res.data.total_reviews || 0,
                this_month_reviews: thisMonthReviews
              }
            }
            
            const hasData = totalDays > 0 || feedbackData.this_month_reviews > 0
            
            return {
              ...staff,
              daysPresent,
              daysAbsent,
              attendancePercent,
              ...feedbackData,
              hasData
            }
          }))
          
          setReportData(data)
        } catch {
          setReportData([])
        } finally {
          setLoadingReport(false)
        }
      }
      fetchReport()
    }
  }, [activeTab, selectedMonth, staffList])

  // ── Sign out ─────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── Presence toggle ──────────────────────────────────────────────────
  const handleTogglePresence = async (id: string, currentStatus: boolean, isWarden?: boolean) => {
    const today = new Date().toISOString().split('T')[0]
    const newStatus = !currentStatus

    // Optimistic update
    setStaffList(prev => prev.map(s => s.id === id ? { ...s, is_present: newStatus } : s))

    try {
      if (isWarden) {
        await supabase.from('staff_attendance').upsert({
          profile_id: id,
          staff_type: 'warden',
          date: today,
          is_present: newStatus
        }, { onConflict: 'profile_id,date' })
      } else {
        await supabase.from('staff_attendance').upsert({
          staff_id: id,
          staff_type: 'staff_member',
          date: today,
          is_present: newStatus
        }, { onConflict: 'staff_id,date' })

        // Also update staff_members table
        await supabase.from('staff_members').update({ is_present: newStatus }).eq('id', id)
      }
    } catch {
      // Revert optimistic update on failure
      setStaffList(prev => prev.map(s => s.id === id ? { ...s, is_present: currentStatus } : s))
    }
  }

  // ── Add staff ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    setAddMessage('')

    try {
      const { error: insertError } = await supabase
        .from('staff_members')
        .insert({
          full_name: formData.full_name,
          phone: formData.phone,
          email: formData.email || null,
          staff_role: formData.staff_role,
          is_present: false
        })

      if (insertError) {
        setAddError('Failed to add staff member.')
        return
      }

      setAddMessage('Added successfully')
      setFormData({ full_name: '', phone: '', staff_role: 'cleaner', email: '' })
      setTimeout(() => setAddMessage(''), 3000)
      fetchStaff()
    } catch {
      setAddError('Failed to add staff member.')
    }
  }

  // ── Delete staff (modal only) ────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await supabase.from('staff_members').delete().eq('id', id)
    } catch {
      // Silently fail
    } finally {
      setConfirmingDeleteId(null)
      fetchStaff()
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'warden': return 'bg-gray-900 text-white'
      case 'admin': return 'bg-blue-50 text-blue-700'
      case 'cleaner': return 'bg-green-50 text-green-700'
      case 'security': return 'bg-orange-50 text-orange-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const presentCount = staffList.filter(s => s.is_present).length
  const absentCount = staffList.filter(s => !s.is_present).length
  const totalCount = staffList.length

  // staff_members only (for Remove tab)
  const deletableStaff = staffList.filter(s => !s.isWarden)

  return (
    <div className="min-h-screen bg-white p-8 max-w-5xl mx-auto">
      <PageHeader title="Staff Directory" showBack onSignOut={handleSignOut} />

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-4 mt-8 mb-8">
        <div className="border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Present Today</p>
          <p className="text-2xl font-medium text-green-600">{presentCount}</p>
        </div>
        <div className="border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Absent Today</p>
          <p className="text-2xl font-medium text-red-500">{absentCount}</p>
        </div>
        <div className="border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total Staff</p>
          <p className="text-2xl font-medium text-gray-600">{totalCount}</p>
        </div>
      </div>

      {/* ── Staff list header ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium tracking-tight text-gray-900">Staff Members</h2>
        <button
          onClick={() => { setModalOpen(true); setActiveTab('add') }}
          className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Manage Staff
        </button>
      </div>

      {/* ── Staff list ── */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : staffList.length === 0 ? (
        <p className="text-sm text-gray-400">No staff members added yet.</p>
      ) : (
        <div className="space-y-3">
          {staffList.map(staff => (
            <div
              key={staff.id}
              className="border border-gray-100 rounded-xl p-4 flex items-center justify-between hover:border-gray-300 transition-colors"
            >
              <div className="grid grid-cols-4 gap-4 flex-1 mr-4 items-center min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{staff.full_name}</p>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium w-fit ${getRoleBadgeColor(staff.staff_role)}`}>
                  {staff.staff_role.charAt(0).toUpperCase() + staff.staff_role.slice(1)}
                </span>
                <p className="text-sm text-gray-500 truncate">{staff.phone || '—'}</p>
                <p className="text-sm text-gray-500 truncate">{staff.email || '—'}</p>
              </div>
              <button
                onClick={() => handleTogglePresence(staff.id, staff.is_present, staff.isWarden)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors flex-shrink-0 ${staff.is_present
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
              >
                {staff.is_present ? '✓ Present' : '✗ Absent'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Manage Staff Modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 border border-gray-200">

            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-medium text-gray-900">Manage Staff</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-gray-100 mb-5">
              <button
                onClick={() => setActiveTab('add')}
                className={`pb-3 text-sm transition-colors ${activeTab === 'add'
                    ? 'border-b-2 border-gray-900 text-gray-900 font-medium'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Add Staff
              </button>
              <button
                onClick={() => { setActiveTab('remove'); setConfirmingDeleteId(null) }}
                className={`pb-3 text-sm transition-colors ${activeTab === 'remove'
                    ? 'border-b-2 border-gray-900 text-gray-900 font-medium'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Remove Staff
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className={`pb-3 text-sm transition-colors ${activeTab === 'report'
                    ? 'border-b-2 border-gray-900 text-gray-900 font-medium'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Monthly Report
              </button>
            </div>

            {/* ── Tab: Add Staff ── */}
            {activeTab === 'add' && (
              <form onSubmit={handleSubmit} className="space-y-3">
                {addMessage && (
                  <p className="text-xs text-green-600 font-medium">{addMessage}</p>
                )}
                {addError && (
                  <p className="text-xs text-red-500">{addError}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-gray-500 outline-none"
                      value={formData.full_name}
                      onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Phone</label>
                    <input
                      required
                      type="tel"
                      placeholder="e.g. 9876543210"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-gray-500 outline-none"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email <span className="text-gray-300">(optional)</span></label>
                    <input
                      type="email"
                      placeholder="e.g. ramesh@hostel.in"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-gray-500 outline-none"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Role</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-gray-500 outline-none bg-white"
                      value={formData.staff_role}
                      onChange={e => setFormData({ ...formData, staff_role: e.target.value })}
                    >
                      <option value="warden">Warden</option>
                      <option value="admin">Admin</option>
                      <option value="cleaner">Cleaner</option>
                      <option value="security">Security</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors w-full mt-1"
                >
                  Add Staff Member
                </button>
              </form>
            )}

            {/* ── Tab: Remove Staff ── */}
            {activeTab === 'remove' && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {deletableStaff.length === 0 ? (
                  <p className="text-sm text-gray-400">No removable staff members.</p>
                ) : (
                  deletableStaff.map(staff => (
                    <div key={staff.id} className="border border-gray-100 rounded-xl p-3">
                      {confirmingDeleteId === staff.id ? (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-700">Remove <span className="font-medium">{staff.full_name}</span>?</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(staff.id)}
                              className="bg-red-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-700 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{staff.full_name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${getRoleBadgeColor(staff.staff_role)}`}>
                              {staff.staff_role.charAt(0).toUpperCase() + staff.staff_role.slice(1)}
                            </span>
                          </div>
                          <button
                            onClick={() => setConfirmingDeleteId(staff.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
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
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-gray-500 outline-none w-full"
                />

                {loadingReport ? (
                  <p className="text-sm text-gray-400">Loading report...</p>
                ) : reportData.length === 0 ? (
                  <p className="text-sm text-gray-400">No staff members found.</p>
                ) : (
                  reportData.map((staff) => (
                    <div key={staff.id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <p className="text-sm font-medium text-gray-900">{staff.full_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadgeColor(staff.staff_role)}`}>
                          {staff.staff_role.charAt(0).toUpperCase() + staff.staff_role.slice(1)}
                        </span>
                      </div>

                      {!staff.hasData ? (
                        <p className="text-xs text-gray-400">No data for this month</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Attendance</p>
                            <p className="text-gray-900">Days Present: {staff.daysPresent}</p>
                            <p className="text-gray-900">Days Absent: {staff.daysAbsent}</p>
                            <p className="text-gray-900 font-medium mt-1">Attendance %: {staff.attendancePercent}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Feedback</p>
                            <p className="text-gray-900 flex items-center gap-1">
                              {Number(staff.average_rating || 0).toFixed(1)} <span className="text-yellow-400">★</span>
                            </p>
                            <p className="text-gray-500 text-xs mt-1">{staff.total_reviews} total reviews</p>
                            <p className="text-gray-500 text-xs">{staff.this_month_reviews} this month reviews</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}