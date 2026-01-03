import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireWarden } from '../middleware/rbac.js'

const router = Router()

router.get('/dashboard', authenticate, requireWarden, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const startOfMonth = `${today.substring(0, 7)}-01`

    // Attendance stats
    const { count: totalStudents } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })

    const { count: presentToday } = await supabaseAdmin
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('date', today)
      .eq('status', 'present')

    const total = totalStudents || 0
    const present = presentToday || 0
    const absent = total - present
    const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0

    // Leave stats
    const { count: pendingLeaves } = await supabaseAdmin
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    const { count: approvedLeavesMonth } = await supabaseAdmin
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('created_at', startOfMonth)

    const { count: rejectedLeavesMonth } = await supabaseAdmin
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected')
      .gte('created_at', startOfMonth)

    // Complaints stats
    const { count: openComplaints } = await supabaseAdmin
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')

    const { count: inProgressComplaints } = await supabaseAdmin
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress')

    const { count: resolvedComplaintsMonth } = await supabaseAdmin
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved')
      .gte('resolution_date', startOfMonth)

    // Notices stats
    const { count: totalActiveNotices } = await supabaseAdmin
      .from('notices')
      .select('*', { count: 'exact', head: true })

    res.json({
      success: true,
      data: {
        attendance: {
          today_present: present,
          today_absent: absent,
          today_percentage: Number(percentage)
        },
        leaves: {
          pending_count: pendingLeaves || 0,
          approved_this_month: approvedLeavesMonth || 0,
          rejected_this_month: rejectedLeavesMonth || 0
        },
        complaints: {
          open_count: openComplaints || 0,
          in_progress_count: inProgressComplaints || 0,
          resolved_this_month: resolvedComplaintsMonth || 0
        },
        notices: {
          total_active: totalActiveNotices || 0
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

export default router
