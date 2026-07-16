import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireStudent, requireWarden } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { leaveSchema } from '../config/validation.js';
import logger from '../config/logger.js';
import { deleteCache, publishEvent } from '../config/redis.js';
import { createNotification } from '../config/notify.js';
import { auditLog } from '../config/audit.js';
import { emitToUser } from '../config/socket.js';

const router = Router();

router.post('/', authenticate, requireStudent, validate(leaveSchema), async (req, res, next) => {
  try {
    const { start_date, end_date, reason } = req.body;

    const today = new Date().toISOString().split('T')[0];

    if (start_date < today) {
      return res.status(400).json({ success: false, error: 'start_date cannot be in the past' });
    }

    if (end_date < start_date) {
      return res
        .status(400)
        .json({ success: false, error: 'end_date must be after or equal to start_date' });
    }

    const { data: record, error } = await supabaseAdmin
      .from('leave_requests')
      .insert({
        student_id: req.user.id,
        start_date,
        end_date,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {throw error;}

    logger.info(`Leave request submitted by user ${req.user.id}`);
    await deleteCache('stats:dashboard');
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

router.get('/my', authenticate, requireStudent, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .eq('student_id', req.user.id)
      // .is('deleted_at', null)
      .limit(limit)
      .order('created_at', { ascending: false });

    if (error) {throw error;}

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/all', authenticate, requireWarden, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('leave_requests')
      .select(
        `
    *,
    students!leave_requests_student_id_fkey (
      roll_number,
      profiles!students_id_fkey (
        full_name
      )
    )
  `,
        { count: 'exact' }
      )
      // .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }
    if (req.query.student_id) {
      query = query.eq('student_id', req.query.student_id);
    }

    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {throw error;}

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/approve', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .update({ status: 'approved', approved_by: req.user.id })
      .eq('id', id)
      .select()
      .single();

    if (error) {throw error;}
    if (!data) {return res.status(404).json({ success: false, error: 'Leave request not found' });}

    logger.info(`Leave request ${id} approved by ${req.user.id}`);

    await createNotification(
      data.student_id,
      'Leave Approved',
      'Your leave request has been approved',
      'leave',
      id
    );
    await auditLog(req.user.id, 'approve_leave', 'leave_request', id);
    emitToUser(data.student_id, 'leave:updated', { id, status: 'approved' });
    publishEvent('leaves', { id, status: 'approved', student_id: data.student_id });

    await deleteCache('stats:dashboard');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/reject', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .update({ status: 'rejected', approved_by: req.user.id })
      .eq('id', id)
      .select()
      .single();

    if (error) {throw error;}
    if (!data) {return res.status(404).json({ success: false, error: 'Leave request not found' });}

    logger.info(`Leave request ${id} rejected by ${req.user.id}`);

    await createNotification(
      data.student_id,
      'Leave Rejected',
      'Your leave request has been rejected',
      'leave',
      id
    );
    await auditLog(req.user.id, 'reject_leave', 'leave_request', id);
    emitToUser(data.student_id, 'leave:updated', { id, status: 'rejected' });
    publishEvent('leaves', { id, status: 'rejected', student_id: data.student_id });

    await deleteCache('stats:dashboard');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;

router.delete('/:id', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('leave_requests')
      .delete()
      .eq('id', id)
      .eq('student_id', req.user.id);

    if (error) {throw error;}
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
