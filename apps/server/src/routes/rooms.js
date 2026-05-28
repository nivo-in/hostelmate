import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireStudent, requireWarden } from '../middleware/rbac.js'
import { createNotification } from '../config/notify.js'
import { auditLog } from '../config/audit.js'
import logger from '../config/logger.js'

const router = Router()

router.get('/my', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { data: student, error } = await supabaseAdmin
      .from('students')
      .select(`
        room_id,
        rooms!students_room_id_fkey(
          room_number,
          capacity,
          blocks!rooms_block_id_fkey(name)
        )
      `)
      .eq('id', req.user.id)
      .single()

    if (error) throw error

    let roommates = []
    if (student?.room_id) {
      const { data: rmData } = await supabaseAdmin
        .from('students')
        .select('id, profiles!students_id_fkey(full_name)')
        .eq('room_id', student.room_id)
        .neq('id', req.user.id)
      
      roommates = rmData?.map(r => r.profiles?.full_name) || []
    }

    // Flatten block name for convenience
    const room = student?.rooms ? {
      room_number: student.rooms.room_number,
      capacity: student.rooms.capacity,
      block_name: student.rooms.blocks?.name || ''
    } : null

    res.json({ success: true, data: { student: { ...student, rooms: room }, roommates } })
  } catch (error) {
    next(error)
  }
})

router.get('/available', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { data: roomsData, error: roomsError } = await supabaseAdmin
      .from('rooms')
      .select('id, room_number, capacity, blocks!rooms_block_id_fkey(name)')
      .order('room_number')

    if (roomsError) throw roomsError

    const { data: studentsData, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('room_id')
      .not('room_id', 'is', null)

    if (studentsError) throw studentsError

    const available = roomsData.map(room => {
      const occupants = studentsData.filter(s => s.room_id === room.id).length
      return {
        id: room.id,
        room_number: room.room_number,
        block_name: room.blocks?.name || '',
        capacity: room.capacity,
        occupancy: occupants
      }
    }).filter(r => r.occupancy < r.capacity)

    res.json({ success: true, data: available })
  } catch (error) {
    next(error)
  }
})

router.get('/', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { data: roomsData, error: roomsError } = await supabaseAdmin
      .from('rooms')
      .select(`
        id, 
        room_number, 
        capacity,
        blocks!rooms_block_id_fkey(name)
      `)

    if (roomsError) throw roomsError

    const { data: studentsData, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, roll_number, room_id, profiles!students_id_fkey(full_name)')
      .not('room_id', 'is', null)

    if (studentsError) throw studentsError

    const rooms = roomsData.map(room => {
      const occupants = studentsData.filter(s => s.room_id === room.id)
      return {
        id: room.id,
        room_number: room.room_number,
        block_name: room.blocks?.name || '',
        capacity: room.capacity,
        current_occupants: occupants.map(o => ({
          student_id: o.id,
          roll_number: o.roll_number,
          full_name: o.profiles?.full_name
        })),
        available_slots: room.capacity - occupants.length
      }
    })

    res.json({ success: true, data: { rooms } })
  } catch (error) {
    next(error)
  }
})

router.post('/', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { room_number, block_name, capacity } = req.body

    // 1. Find or create block
    let blockId = ''
    const { data: existingBlocks, error: searchErr } = await supabaseAdmin
      .from('blocks')
      .select('id')
      .eq('name', block_name.trim())
      .limit(1)

    if (searchErr) throw searchErr

    if (existingBlocks && existingBlocks.length > 0) {
      blockId = existingBlocks[0].id
    } else {
      const { data: newBlock, error: insertBlockErr } = await supabaseAdmin
        .from('blocks')
        .insert({ name: block_name.trim() })
        .select('id')
        .single()
        
      if (insertBlockErr) throw insertBlockErr
      blockId = newBlock.id
    }

    // 2. Insert room
    const { data: newRoom, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .insert({
        room_number: room_number.trim(),
        block_id: blockId,
        capacity: parseInt(capacity, 10),
      })
      .select()
      .single()

    if (roomErr) throw roomErr

    await auditLog(req.user.id, 'create_room', 'room', newRoom.id)

    res.json({ success: true, data: newRoom })
  } catch (error) {
    next(error)
  }
})

router.get('/unassigned', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('students')
      .select('id, roll_number, profiles!students_id_fkey(full_name)')
      .is('room_id', null)

    if (error) throw error

    const unassignedStudents = data.map(d => ({
      id: d.id,
      roll_number: d.roll_number,
      full_name: d.profiles?.full_name ?? 'Unknown',
    }))

    res.json({ success: true, data: unassignedStudents })
  } catch (error) {
    next(error)
  }
})

router.post('/assign', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { student_id, room_id } = req.body

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('capacity, room_number, blocks!rooms_block_id_fkey(name)')
      .eq('id', room_id)
      .single()

    if (roomError) throw roomError

    const { count, error: countError } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room_id)

    if (countError) throw countError

    if (count >= room.capacity) {
      return res.status(400).json({ success: false, error: 'Room is full' })
    }

    const { error: updateError } = await supabaseAdmin
      .from('students')
      .update({ room_id })
      .eq('id', student_id)

    if (updateError) throw updateError

    const blockName = room.blocks?.name || ''
    await createNotification(
      student_id,
      'Room Assigned',
      `You have been assigned to Room ${room.room_number}, Block ${blockName}`,
      'notice',
      room_id
    )

    await auditLog(req.user.id, 'assign_room', 'room', room_id, { student_id })

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.post('/transfer-request', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { requested_room_id, reason } = req.body

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('room_id')
      .eq('id', req.user.id)
      .single()

    if (studentError) throw studentError

    const { error: insertError } = await supabaseAdmin
      .from('room_transfer_requests')
      .insert({
        student_id: req.user.id,
        current_room_id: student.room_id,
        requested_room_id,
        reason,
        status: 'pending'
      })

    if (insertError) throw insertError

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.get('/transfer-requests', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('room_transfer_requests')
      .select(`
        *,
        students!room_transfer_requests_student_id_fkey(
          roll_number,
          profiles!students_id_fkey(full_name)
        ),
        current_room:rooms!room_transfer_requests_current_room_id_fkey(room_number),
        requested_room:rooms!room_transfer_requests_requested_room_id_fkey(room_number)
      `)
      .eq('status', 'pending')

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.patch('/transfer-requests/:id/approve', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params

    const { data: request, error: requestError } = await supabaseAdmin
      .from('room_transfer_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (requestError) throw requestError

    const { error: updateStudentError } = await supabaseAdmin
      .from('students')
      .update({ room_id: request.requested_room_id })
      .eq('id', request.student_id)

    if (updateStudentError) throw updateStudentError

    const { error: updateRequestError } = await supabaseAdmin
      .from('room_transfer_requests')
      .update({ status: 'approved' })
      .eq('id', id)

    if (updateRequestError) throw updateRequestError

    await createNotification(
      request.student_id,
      'Transfer Approved',
      'Your room transfer request has been approved',
      'notice',
      id
    )

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.patch('/transfer-requests/:id/reject', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params

    const { data: request, error: requestError } = await supabaseAdmin
      .from('room_transfer_requests')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select()
      .single()

    if (requestError) throw requestError

    await createNotification(
      request.student_id,
      'Transfer Rejected',
      'Your room transfer request has been rejected',
      'notice',
      id
    )

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export default router
