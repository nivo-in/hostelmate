import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireStudent, requireWarden } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { attendanceSchema } from '../config/validation.js'
import { isWithinGeofence } from '../config/geofence.js'
import logger from '../config/logger.js'
import { getCache, setCache, deleteCache } from '../config/redis.js'
import { auditLog } from '../config/audit.js'

const router = Router()

router.post('/mark', authenticate, requireStudent, validate(attendanceSchema), async (req, res, next) => {
  try {
    const { qr_data, lat, lng } = req.body

    let parsedQr
    try {
      parsedQr = typeof qr_data === 'string' ? JSON.parse(qr_data) : qr_data
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid qr_data format' })
    }

    const today = new Date().toISOString().split('T')[0]

    if (parsedQr.date !== today || !parsedQr.token.startsWith(`${today}-secret123`)) {
      return res.status(400).json({ success: false, error: 'Invalid or expired QR code' })
    }

    
    if (parsedQr.nonce) {
      const qrAge = Date.now() - parsedQr.nonce
      if (qrAge > 30000) {
        return res.status(400).json({ success: false, error: 'QR code expired. Please scan the latest QR code.' })
      }
    }

    if (lat !== undefined && lng !== undefined) {
      const hostelLat = parseFloat(process.env.HOSTEL_LAT || '28.6139')
      const hostelLng = parseFloat(process.env.HOSTEL_LNG || '77.2090')
      const { allowed, distance } = isWithinGeofence(lat, lng, hostelLat, hostelLng)
      if (!allowed) {
        return res.status(403).json({ success: false, error: `You are ${Math.round(distance)}m away from hostel. Must be within 100m to mark attendance.` })
      }
    } else {
      logger.warn(`Attendance marked without location verification for user ${req.user.id}`)
    }

    const { data: existing } = await supabaseAdmin
      .from('attendance')
      .select('id')
      .eq('student_id', req.user.id)
      .eq('date', today)
      .single()

    if (existing) {
      return res.status(400).json({ success: false, error: 'Attendance already marked for today' })
    }

    const { data: record, error: insertError } = await supabaseAdmin
      .from('attendance')
      .insert({
        student_id: req.user.id,
        date: today,
        status: 'present',
        scan_time: new Date().toISOString(),
        qr_data: parsedQr,
        lat,
        lng
      })
      .select()
      .single()

    if (insertError) throw insertError

    logger.info(`Attendance marked successfully for user ${req.user.id}`)
    await auditLog(req.user.id, 'mark_attendance', 'attendance', record.id)
    await deleteCache('attendance:stats:today')
    await deleteCache(`attendance:today:${today}`)

    res.json({ success: true, data: record })
  } catch (error) {
    next(error)
  }
})

router.get('/today', authenticate, requireWarden, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const cacheKey = `attendance:today:${today}`

    const cached = await getCache(cacheKey)
    if (cached) {
      logger.info('Cache hit: attendance today')
      return res.json({ success: true, data: cached })
    }
    logger.info('Cache miss: attendance today')

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select(`*, students!attendance_student_id_fkey(roll_number, profiles!students_id_fkey(full_name))`)
      .eq('date', today)

    if (error) throw error

    const formattedData = data.map(item => ({
      id: item.id,
      full_name: item.students?.profiles?.full_name,
      roll_number: item.students?.roll_number,
      status: item.status,
      scan_time: item.scan_time
    }))

    await setCache(cacheKey, formattedData, 120)
    res.json({ success: true, data: formattedData })
  } catch (error) {
    next(error)
  }
})

router.get('/student/:studentId', authenticate, async (req, res, next) => {
  try {
    const { studentId } = req.params
    const { month } = req.query

    if (req.profile.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    let query = supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .order('date', { ascending: false })

    if (month) {
      const startOfMonth = `${month}-01`
      const endOfMonth = `${month}-31`
      query = query.gte('date', startOfMonth).lte('date', endOfMonth)
    }

    const { data, error } = await query
    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.get('/stats', authenticate, requireWarden, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const cacheKey = 'attendance:stats:today'

    const cached = await getCache(cacheKey)
    if (cached) {
      logger.info('Cache hit: attendance stats')
      return res.json({ success: true, data: cached })
    }
    logger.info('Cache miss: attendance stats')

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

    const statsData = {
      total_students: total,
      present_today: present,
      absent_today: absent,
      percentage: Number(percentage)
    }

    await setCache(cacheKey, statsData, 300)
    res.json({ success: true, data: statsData })
  } catch (error) {
    next(error)
  }
})

export default router