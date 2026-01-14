import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireWarden } from '../middleware/rbac.js'
import { getCache, setCache } from '../config/redis.js'
import logger from '../config/logger.js'

const router = Router()

router.get('/dashboard', authenticate, requireWarden, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const startOfMonth = `${today.substring(0, 7)}-01`

    const cacheKey = 'stats:dashboard'
    const cached = await getCache(cacheKey)
    if (cached) {
      logger.info('Cache hit: stats dashboard')
      return res.json({ success: true, data: cached })
    }
    logger.info('Cache miss: stats dashboard')

    // Fetch all stats in parallel to avoid sequential network round-trips
    const [
      { count: totalStudents },
      { count: presentToday },
      { count: pendingLeaves },
      { count: approvedLeavesMonth },
      { count: rejectedLeavesMonth },
      { count: openComplaints },
      { count: inProgressComplaints },
      { count: resolvedComplaintsMonth },
      { count: totalActiveNotices },
      { data: lostFoundData }
    ] = await Promise.all([
      supabaseAdmin.from('students').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('attendance').eq('date', today).eq('status', 'present').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('leave_requests').eq('status', 'pending').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('leave_requests').eq('status', 'approved').gte('created_at', startOfMonth).select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('leave_requests').eq('status', 'rejected').gte('created_at', startOfMonth).select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('complaints').eq('status', 'open').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('complaints').eq('status', 'in_progress').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('complaints').eq('status', 'resolved').gte('resolution_date', startOfMonth).select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('notices').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('lost_and_found').select('status')
    ])

    const total = totalStudents || 0
    const present = presentToday || 0
    const absent = total - present
    const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0

    let totalLost = 0
    let totalFound = 0
    let totalClaimed = 0

    if (lostFoundData) {
      for (const item of lostFoundData) {
        if (item.status === 'lost') totalLost++
        else if (item.status === 'found') totalFound++
        else if (item.status === 'claimed') totalClaimed++
      }
    }

    const statsData = {
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
      },
      lost_found: {
        total_lost: totalLost,
        total_found: totalFound,
        total_claimed: totalClaimed
      }
    }

    await setCache(cacheKey, statsData, 180)
    res.json({
      success: true,
      data: statsData
    })
  } catch (error) {
    next(error)
  }
})

export default router
