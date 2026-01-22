import { Router } from 'express'
import { z } from 'zod'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireWarden } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { createOrder, verifyPaymentSignature, generateReceiptId } from '../config/razorpay.js'
import { createNotification } from '../config/notify.js'
import { getCache, setCache } from '../config/redis.js'
import logger from '../config/logger.js'

const router = Router()

// ────────────────────────────────────────────
// FEE STRUCTURES
// ────────────────────────────────────────────

router.get('/fee-structures', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('fee_structures')
      .select('*')
      .eq('is_active', true)
      .order('billing_period')

    if (error) throw error

    const grouped = {
      yearly: (data || []).filter(f => f.billing_period === 'yearly'),
      monthly: (data || []).filter(f => f.billing_period === 'monthly'),
      one_time: (data || []).filter(f => f.billing_period === 'one_time')
    }

    res.json({ success: true, data: grouped })
  } catch (error) {
    next(error)
  }
})

const feeStructureSchema = z.object({
  name: z.string().min(2),
  amount: z.number().int().positive(),
  fee_type: z.enum(['mess', 'hostel', 'combined', 'maintenance', 'other']),
  billing_period: z.enum(['monthly', 'yearly', 'one_time']),
  includes_hostel: z.boolean().optional(),
  includes_mess: z.boolean().optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  description: z.string().optional()
})

router.post('/fee-structures', authenticate, requireWarden, validate(feeStructureSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('fee_structures')
      .insert(req.body)
      .select()
      .single()

    if (error) throw error

    res.status(201).json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// ────────────────────────────────────────────
// STUDENT + PARENT — own/ward payments
// ────────────────────────────────────────────

router.get('/my', authenticate, async (req, res, next) => {
  try {
    const role = req.profile?.role
    let studentId = req.user.id
    let studentName = null

    // Parent: resolve linked student
    if (role === 'parent') {
      const { data: parentRecord, error: parentError } = await supabaseAdmin
        .from('parents')
        .select('student_id, students!parents_student_id_fkey(id, profiles!students_id_fkey(full_name))')
        .eq('id', req.user.id)
        .single()

      if (parentError || !parentRecord) {
        return res.status(404).json({ success: false, error: 'No linked student found for this parent' })
      }

      studentId = parentRecord.student_id
      studentName = parentRecord.students?.profiles?.full_name || null
    }

    const { data, error } = await supabaseAdmin
      .from('fee_payments')
      .select(`
        *,
        fee_structures (
          id, name, fee_type, billing_period, includes_hostel, includes_mess, description
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const today = new Date().toISOString().split('T')[0]
    const payments = (data || []).map(p => ({
      ...p,
      is_overdue: p.due_date < today && (p.status === 'pending' || p.status === 'processing')
    }))

    const grouped = {
      pending: payments.filter(p => p.status === 'pending' || p.status === 'processing'),
      paid: payments.filter(p => p.status === 'paid'),
      failed: payments.filter(p => p.status === 'failed'),
      all: payments
    }

    const totals = {
      total_paid: grouped.paid.reduce((sum, p) => sum + p.amount, 0),
      total_pending: grouped.pending.reduce((sum, p) => sum + p.amount, 0),
      next_due: grouped.pending.map(p => p.due_date).sort()[0] || null
    }

    res.json({ success: true, data: { payments: grouped, totals, student_name: studentName } })
  } catch (error) {
    next(error)
  }
})

// ────────────────────────────────────────────
// WARDEN — all payments
// ────────────────────────────────────────────

router.get('/all', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { status, billing_period, fee_type, period_label } = req.query

    let query = supabaseAdmin
      .from('fee_payments')
      .select(`
        *,
        fee_structures (
          id, name, fee_type, billing_period, includes_hostel, includes_mess
        ),
        students!fee_payments_student_id_fkey (
          roll_number,
          profiles!students_id_fkey (
            full_name
          )
        )
      `)

    if (status) query = query.eq('status', status)
    if (billing_period) query = query.eq('billing_period', billing_period)
    if (period_label) query = query.eq('period_label', period_label)
    if (fee_type) {
      const { data: feeStructureIds } = await supabaseAdmin
        .from('fee_structures')
        .select('id')
        .eq('fee_type', fee_type)
      if (feeStructureIds) {
        query = query.in('fee_structure_id', feeStructureIds.map(f => f.id))
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error

    const today = new Date().toISOString().split('T')[0]
    const payments = (data || []).map(p => ({
      ...p,
      is_overdue: p.due_date < today && (p.status === 'pending' || p.status === 'processing')
    }))

    const summary = {
      total_collected: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
      total_pending: payments.filter(p => p.status === 'pending' || p.status === 'processing').reduce((sum, p) => sum + p.amount, 0),
      paid_count: payments.filter(p => p.status === 'paid').length,
      pending_count: payments.filter(p => p.status === 'pending' || p.status === 'processing').length
    }

    res.json({ success: true, data: { payments, summary } })
  } catch (error) {
    next(error)
  }
})

// ────────────────────────────────────────────
// RAZORPAY — create order (student OR parent)
// ────────────────────────────────────────────

router.post('/create-order', authenticate, async (req, res, next) => {
  try {
    const role = req.profile?.role
    if (role !== 'student' && role !== 'parent') {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const { fee_payment_id } = req.body
    if (!fee_payment_id) {
      return res.status(400).json({ success: false, error: 'fee_payment_id is required' })
    }

    // For parent: resolve their student_id
    let ownerStudentId = req.user.id
    if (role === 'parent') {
      const { data: parentRecord } = await supabaseAdmin
        .from('parents')
        .select('student_id')
        .eq('id', req.user.id)
        .single()
      if (!parentRecord) return res.status(404).json({ success: false, error: 'No linked student' })
      ownerStudentId = parentRecord.student_id
    }

    const { data: payment, error } = await supabaseAdmin
      .from('fee_payments')
      .select('*, fee_structures(name)')
      .eq('id', fee_payment_id)
      .eq('student_id', ownerStudentId)
      .single()

    if (error || !payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' })
    }

    if (payment.status !== 'pending' && payment.status !== 'processing') {
      return res.status(400).json({ success: false, error: `Payment is already ${payment.status}` })
    }

    const receipt = generateReceiptId(ownerStudentId, payment.period_label)
    const order = await createOrder(payment.amount, 'INR', receipt)

    const { error: updateError } = await supabaseAdmin
      .from('fee_payments')
      .update({ razorpay_order_id: order.id, status: 'processing' })
      .eq('id', fee_payment_id)

    if (updateError) throw updateError

    res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: payment.amount,
        currency: 'INR',
        key_id: process.env.RAZORPAY_KEY_ID,
        receipt,
        fee_name: payment.fee_structures?.name
      }
    })
  } catch (error) {
    next(error)
  }
})

// ────────────────────────────────────────────
// RAZORPAY — verify payment (student OR parent)
// ────────────────────────────────────────────

const verifySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  fee_payment_id: z.string().uuid()
})

router.post('/verify', authenticate, validate(verifySchema), async (req, res, next) => {
  try {
    const role = req.profile?.role
    if (role !== 'student' && role !== 'parent') {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, fee_payment_id } = req.body

    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' })
    }

    // Resolve student_id
    let studentId = req.user.id
    if (role === 'parent') {
      const { data: parentRecord } = await supabaseAdmin
        .from('parents')
        .select('student_id')
        .eq('id', req.user.id)
        .single()
      if (!parentRecord) return res.status(404).json({ success: false, error: 'No linked student' })
      studentId = parentRecord.student_id
    }

    const { data: payment, error } = await supabaseAdmin
      .from('fee_payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: 'razorpay',
        razorpay_payment_id,
        razorpay_signature
      })
      .eq('id', fee_payment_id)
      .eq('student_id', studentId)
      .select('*, fee_structures(name)')
      .single()

    if (error) throw error
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' })

    const feeName = payment.fee_structures?.name || 'Fee'
    const amountFormatted = `₹${payment.amount.toLocaleString('en-IN')}`

    // Notify student
    await createNotification(
      studentId,
      'Payment Successful',
      `Payment of ${amountFormatted} received for ${feeName}. Receipt: ${payment.receipt_number}`,
      'payment',
      fee_payment_id
    )

    // Check remaining pending payments and notify
    const { data: remaining } = await supabaseAdmin
      .from('fee_payments')
      .select('id')
      .eq('student_id', studentId)
      .in('status', ['pending', 'processing'])

    if (remaining && remaining.length > 0) {
      await createNotification(
        studentId,
        'Pending Payments',
        `You have ${remaining.length} more pending payment${remaining.length > 1 ? 's' : ''} due.`,
        'payment',
        null
      )
    }

    logger.info(`Payment verified: ${fee_payment_id} by ${role} ${req.user.id}`)
    res.json({ success: true, receipt_number: payment.receipt_number })
  } catch (error) {
    next(error)
  }
})

// ────────────────────────────────────────────
// CANCEL processing payment
// ────────────────────────────────────────────
router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    const role = req.profile?.role
    if (role !== 'student' && role !== 'parent') {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const { fee_payment_id } = req.body
    
    let ownerStudentId = req.user.id
    if (role === 'parent') {
      const { data: parentRecord } = await supabaseAdmin
        .from('parents')
        .select('student_id')
        .eq('id', req.user.id)
        .single()
      if (!parentRecord) return res.status(404).json({ success: false, error: 'No linked student' })
      ownerStudentId = parentRecord.student_id
    }

    const { error } = await supabaseAdmin
      .from('fee_payments')
      .update({ status: 'pending', razorpay_order_id: null })
      .eq('id', fee_payment_id)
      .eq('student_id', ownerStudentId)
      .eq('status', 'processing')

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// ────────────────────────────────────────────
// WARDEN — generate bills + notify
// ────────────────────────────────────────────

const generateBillsSchema = z.object({
  fee_structure_id: z.string().uuid(),
  period_label: z.string().min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  student_ids: z.array(z.string().uuid()).optional() // if omitted, generates for all students
})

router.post('/generate-bills', authenticate, requireWarden, validate(generateBillsSchema), async (req, res, next) => {
  try {
    const { fee_structure_id, period_label, due_date } = req.body

    const { data: feeStructure, error: fsError } = await supabaseAdmin
      .from('fee_structures')
      .select('*')
      .eq('id', fee_structure_id)
      .single()

    if (fsError || !feeStructure) {
      return res.status(404).json({ success: false, error: 'Fee structure not found' })
    }

    let query = supabaseAdmin
      .from('students')
      .select('id, profiles!students_id_fkey(full_name)')

    if (req.body.student_ids && req.body.student_ids.length > 0) {
      query = query.in('id', req.body.student_ids)
    }

    const { data: students, error: studentsError } = await query
    if (studentsError) throw studentsError

    const bills = (students || []).map(student => ({
      student_id: student.id,
      fee_structure_id,
      amount: feeStructure.amount,
      status: 'pending',
      billing_period: feeStructure.billing_period,
      period_label,
      due_date
    }))

    let generated = 0
    let skipped = 0

    for (const bill of bills) {
      const { error: insertError } = await supabaseAdmin
        .from('fee_payments')
        .insert(bill)

      if (insertError) {
        if (insertError.code === '23505') {
          skipped++
        } else {
          logger.error(`Failed to insert bill for student ${bill.student_id}: ${insertError.message}`)
          skipped++
        }
      } else {
        generated++

        const student = students.find(s => s.id === bill.student_id)
        const studentName = student?.profiles?.full_name || 'Student'
        const amountFormatted = `₹${feeStructure.amount.toLocaleString('en-IN')}`

        // Notify student
        await createNotification(
          bill.student_id,
          'New Fee Bill Generated',
          `New fee bill: ${amountFormatted} for ${feeStructure.name} (${period_label}). Due: ${due_date}`,
          'payment',
          null
        )

        // Notify linked parent
        const { data: parentRecord } = await supabaseAdmin
          .from('parents')
          .select('id')
          .eq('student_id', bill.student_id)
          .single()

        if (parentRecord) {
          await createNotification(
            parentRecord.id,
            'Fee Bill Raised',
            `Fee bill raised for ${studentName}: ${amountFormatted} for ${feeStructure.name} due on ${due_date}`,
            'payment',
            null
          )
        }
      }
    }

    logger.info(`Bills generated: ${generated}, skipped: ${skipped} for period ${period_label}`)
    res.json({ success: true, generated, skipped })
  } catch (error) {
    next(error)
  }
})

// ────────────────────────────────────────────
// ────────────────────────────────────────────
// WARDEN — list students (for bill generation search)
// ────────────────────────────────────────────

router.get('/students-list', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { search } = req.query

    const query = supabaseAdmin
      .from('students')
      .select('id, roll_number, profiles!students_id_fkey(full_name, email)')
      .order('roll_number')

    const { data, error } = await query
    if (error) throw error

    let students = data || []

    if (search) {
      const q = search.toString().toLowerCase()
      students = students.filter(s =>
        s.profiles?.full_name?.toLowerCase().includes(q) ||
        s.roll_number?.toLowerCase().includes(q)
      )
    }

    res.json({ success: true, data: students })
  } catch (error) {
    next(error)
  }
})

// WARDEN — send due reminders
// ────────────────────────────────────────────

router.post('/send-reminders', authenticate, requireWarden, async (req, res, next) => {
  try {
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    const cutoff = threeDaysFromNow.toISOString().split('T')[0]

    const { data: pendingPayments, error } = await supabaseAdmin
      .from('fee_payments')
      .select(`
        *,
        fee_structures(name),
        students!fee_payments_student_id_fkey(
          id,
          profiles!students_id_fkey(full_name)
        )
      `)
      .in('status', ['pending', 'processing'])
      .lte('due_date', cutoff)

    if (error) throw error

    let remindersSent = 0

    for (const payment of (pendingPayments || [])) {
      const feeName = payment.fee_structures?.name || 'Fee'
      const amountFormatted = `₹${payment.amount.toLocaleString('en-IN')}`
      const studentId = payment.student_id
      const studentName = payment.students?.profiles?.full_name || 'Student'

      // Notify student
      await createNotification(
        studentId,
        'Fee Payment Due',
        `${amountFormatted} for ${feeName} is due on ${payment.due_date}. Pay now to avoid late fees.`,
        'notice',
        payment.id
      )
      remindersSent++

      // Notify parent if linked
      const { data: parentRecord } = await supabaseAdmin
        .from('parents')
        .select('id')
        .eq('student_id', studentId)
        .single()

      if (parentRecord) {
        await createNotification(
          parentRecord.id,
          'Hostel Fee Due',
          `Your ward ${studentName}'s ${feeName} of ${amountFormatted} is due on ${payment.due_date}.`,
          'notice',
          payment.id
        )
        remindersSent++
      }
    }

    // Store last reminder timestamp in Redis
    await setCache('payments:last_reminder', new Date().toISOString(), 60 * 60 * 24 * 30)

    logger.info(`Fee reminders sent: ${remindersSent} for ${(pendingPayments || []).length} payments`)
    res.json({ success: true, reminders_sent: remindersSent })
  } catch (error) {
    next(error)
  }
})

// ────────────────────────────────────────────
// WARDEN — last reminder timestamp
// ────────────────────────────────────────────

router.get('/last-reminder', authenticate, requireWarden, async (req, res, next) => {
  try {
    const lastReminder = await getCache('payments:last_reminder')
    res.json({ success: true, last_reminder: lastReminder })
  } catch (error) {
    next(error)
  }
})

// ────────────────────────────────────────────
// WARDEN — mark paid (cash/offline)
// ────────────────────────────────────────────

router.patch('/:id/mark-paid', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params
    const { payment_method, notes } = req.body

    const { data, error } = await supabaseAdmin
      .from('fee_payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: payment_method || 'cash',
        notes: notes || null
      })
      .eq('id', id)
      .select('*, fee_structures(name)')
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ success: false, error: 'Payment not found' })

    const feeName = data.fee_structures?.name || 'Fee'
    await createNotification(
      data.student_id,
      'Payment Recorded',
      `Payment of ₹${data.amount.toLocaleString('en-IN')} recorded for ${feeName}. Receipt: ${data.receipt_number}`,
      'payment',
      id
    )

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// ────────────────────────────────────────────
// RECEIPT
// ────────────────────────────────────────────

router.get('/receipt/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('fee_payments')
      .select(`
        *,
        fee_structures (
          name, fee_type, billing_period, description
        ),
        students!fee_payments_student_id_fkey (
          roll_number,
          profiles!students_id_fkey (
            full_name, email
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Receipt not found' })
    }

    const role = req.profile?.role
    if (role === 'student' && data.student_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    if (role === 'parent') {
      const { data: parentRecord } = await supabaseAdmin
        .from('parents')
        .select('student_id')
        .eq('id', req.user.id)
        .single()
      if (!parentRecord || parentRecord.student_id !== data.student_id) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
      }
    }

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

export default router
