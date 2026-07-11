import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireStudent, requireWarden } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { createNotification } from '../config/notify.js';

const router = Router();

const visitorSchema = z.object({
  visitor_name: z.string().min(2),
  visitor_phone: z.string().min(10).max(15),
  purpose: z.string().min(10),
  relationship: z.enum(['parent', 'sibling', 'relative', 'friend', 'other']),
  expected_visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post('/', authenticate, requireStudent, validate(visitorSchema), async (req, res, next) => {
  try {
    const { visitor_name, visitor_phone, purpose, relationship, expected_visit_date } = req.body;

    const { data: record, error } = await supabaseAdmin
      .from('visitors')
      .insert({
        student_id: req.user.id,
        visitor_name,
        visitor_phone,
        purpose,
        relationship,
        expected_visit_date,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Fetch student profile for notification
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', req.user.id)
      .single();

    const studentName = profile?.full_name || 'Student';

    // Fetch all wardens
    const { data: wardens } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['warden', 'admin']);

    if (wardens) {
      for (const warden of wardens) {
        await createNotification(
          warden.id,
          'New Visitor Request',
          `New visitor request from ${studentName} for ${visitor_name}`,
          'visitor',
          record.id
        );
      }
    }

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

router.get('/my', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('visitors')
      .select('*')
      .eq('student_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { status, date, search, student_id, sort } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin.from('visitors').select(
      `
        *,
        students!visitors_student_id_fkey (
          roll_number,
          profiles!students_id_fkey (
            full_name
          )
        )
      `,
      { count: 'exact' }
    );

    if (status) query = query.eq('status', status);
    if (date) query = query.eq('expected_visit_date', date);
    if (student_id) query = query.eq('student_id', student_id);
    if (search) query = query.or(`visitor_name.ilike.%${search}%,visitor_phone.ilike.%${search}%`);

    if (sort === 'date') {
      query = query.range(from, to).order('expected_visit_date', { ascending: false });
    } else {
      query = query.range(from, to).order('created_at', { ascending: false });
    }

    const { data, count, error } = await query;

    if (error) throw error;

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
    const { warden_notes } = req.body;

    const updates = { status: 'approved' };
    if (warden_notes !== undefined) updates.warden_notes = warden_notes;

    const { data, error } = await supabaseAdmin
      .from('visitors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Visitor request not found' });

    await createNotification(
      data.student_id,
      'Visitor Approved',
      `Your visitor ${data.visitor_name} has been approved for ${data.expected_visit_date}`,
      'visitor',
      id
    );

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/reject', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { warden_notes } = req.body;

    const updates = { status: 'rejected' };
    if (warden_notes !== undefined) updates.warden_notes = warden_notes;

    const { data, error } = await supabaseAdmin
      .from('visitors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Visitor request not found' });

    await createNotification(
      data.student_id,
      'Visitor Rejected',
      `Your visitor request for ${data.visitor_name} has been rejected`,
      'visitor',
      id
    );

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/checkin', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('visitors')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (existing.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Visitor must be approved before check-in' });
    }

    const { data, error } = await supabaseAdmin
      .from('visitors')
      .update({ status: 'checked_in', check_in_time: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Visitor request not found' });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/checkout', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('visitors')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (existing.status !== 'checked_in') {
      return res.status(400).json({ success: false, error: 'Visitor must be checked in before check-out' });
    }

    const { data, error } = await supabaseAdmin
      .from('visitors')
      .update({ status: 'checked_out', check_out_time: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Visitor request not found' });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
