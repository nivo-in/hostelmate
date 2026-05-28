import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireParent } from '../middleware/rbac.js'

const router = Router()

/**
 * GET /api/parent/my-student
 * Returns the linked student's profile + today's attendance for the authenticated parent.
 * Uses supabaseAdmin to bypass RLS.
 */
router.get('/my-student', authenticate, requireParent, async (req, res, next) => {
  try {
    // Look up parent row — parents.id = parent's auth user id
    const { data: parentRow, error: parentErr } = await supabaseAdmin
      .from('parents')
      .select('student_id, relation')
      .eq('id', req.user.id)
      .single()

    if (parentErr || !parentRow) {
      return res.status(404).json({ success: false, error: 'No student linked to this parent account' })
    }

    const { student_id } = parentRow

    // Fetch student profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, avatar_url')
      .eq('id', student_id)
      .single()

    if (profileErr) throw profileErr

    // Fetch student roll number & room
    const { data: studentRow } = await supabaseAdmin
      .from('students')
      .select('roll_number, room_id, rooms!students_room_id_fkey(room_number, blocks!rooms_block_id_fkey(name))')
      .eq('id', student_id)
      .single()

    // Fetch today's attendance
    const today = new Date().toISOString().split('T')[0]
    const { data: todayAttendance } = await supabaseAdmin
      .from('attendance')
      .select('id, date, status, scan_time, face_verified')
      .eq('student_id', student_id)
      .eq('date', today)
      .single()

    // Fetch this month's attendance
    const month = new Date().toISOString().slice(0, 7)
    const { data: monthAttendance } = await supabaseAdmin
      .from('attendance')
      .select('id, date, status, scan_time')
      .eq('student_id', student_id)
      .gte('date', `${month}-01`)
      .order('date', { ascending: false })

    res.json({
      success: true,
      data: {
        student: {
          id: student_id,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          phone: profile?.phone ?? null,
          avatar_url: profile?.avatar_url ?? null,
          roll_number: studentRow?.roll_number ?? null,
          room_number: studentRow?.rooms?.room_number ?? null,
          block_name: studentRow?.rooms?.blocks?.name ?? null,
        },
        today_attendance: todayAttendance ?? null,
        month_attendance: monthAttendance ?? [],
        relation: parentRow.relation,
      }
    })
  } catch (error) {
    next(error)
  }
})

export default router
