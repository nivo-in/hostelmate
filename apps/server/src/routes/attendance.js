import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireStudent, requireWarden, requireStaff } from '../middleware/rbac.js'

const router = Router()

router.post('/mark', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { qr_data, lat, lng } = req.body
    
    if (!qr_data) {
      return res.status(400).json({ success: false, error: 'qr_data is required' })
    }

    let parsedQr
    try {
      parsedQr = typeof qr_data === 'string' ? JSON.parse(qr_data) : qr_data
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid qr_data format' })
    }

    const today = new Date().toISOString().split('T')[0]
    const expectedToken = `${today}-secret123`

    if (parsedQr.token !== expectedToken) {
      return res.status(400).json({ success: false, error: 'Invalid or expired QR code' })
    }

    const { data: existing, error: checkError } = await supabaseAdmin
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

    res.json({ success: true, data: record })
  } catch (error) {
    next(error)
  }
})

router.get('/today', authenticate, requireWarden, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select(`
        id,
        status,
        scan_time,
        student:student_id (
          id,
          roll_number,
          profile:id (
            full_name
          )
        )
      `)
      .eq('date', today)

    if (error) throw error

    const formattedData = data.map(item => ({
      id: item.id,
      full_name: item.student?.profile?.full_name,
      roll_number: item.student?.roll_number,
      status: item.status,
      scan_time: item.scan_time
    }))

    res.json({ success: true, data: formattedData })
  } catch (error) {
    next(error)
  }
})

router.get('/student/:studentId', authenticate, requireStaff, async (req, res, next) => {
  try {
    const { studentId } = req.params
    const { month } = req.query // format: YYYY-MM

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

    const { count: totalStudents, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })

    if (studentsError) throw studentsError

    const { count: presentToday, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('date', today)
      .eq('status', 'present')

    if (attendanceError) throw attendanceError

    const total = totalStudents || 0
    const present = presentToday || 0
    const absent = total - present
    const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0

    res.json({
      success: true,
      data: {
        total_students: total,
        present_today: present,
        absent_today: absent,
        percentage: Number(percentage)
      }
    })
  } catch (error) {
    next(error)
  }
})

export default router
