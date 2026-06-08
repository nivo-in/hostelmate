import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireStudent } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import logger from '../config/logger.js';

const router = Router();

const staffFeedbackSchema = z.object({
  staff_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

// GET / — requireWarden
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data: staffMembers, error: staffError } = await supabaseAdmin
      .from('staff_members')
      .select('*');

    if (staffError) throw staffError;

    const { data: allFeedback, error: feedbackError } = await supabaseAdmin
      .from('staff_feedback')
      .select('*');

    if (feedbackError) throw feedbackError;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const summary = staffMembers.map((staff) => {
      const staffFeedback = allFeedback.filter((f) => f.staff_id === staff.id);
      const total_reviews = staffFeedback.length;
      const average_rating =
        total_reviews > 0
          ? staffFeedback.reduce((acc, curr) => acc + curr.rating, 0) / total_reviews
          : 0;
      const this_month_reviews = staffFeedback.filter((f) => {
        const d = new Date(f.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }).length;

      return {
        ...staff,
        average_rating: Number(average_rating.toFixed(1)),
        total_reviews,
        this_month_reviews,
      };
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

// GET /:staffId — authenticate (any role)
router.get('/:staffId', authenticate, async (req, res, next) => {
  try {
    const { staffId } = req.params;

    const { data: feedbackData, error } = await supabaseAdmin
      .from('staff_feedback')
      .select(
        `
    *,
    students!staff_feedback_student_id_fkey (
      profiles!students_id_fkey (
        full_name
      )
    )
  `
      )
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const total_reviews = feedbackData.length;
    const average_rating =
      total_reviews > 0
        ? feedbackData.reduce((acc, curr) => acc + curr.rating, 0) / total_reviews
        : 0;

    res.json({
      success: true,
      data: {
        feedback: feedbackData,
        average_rating: Number(average_rating.toFixed(1)),
        total_reviews,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST / — requireStudent
router.post(
  '/',
  authenticate,
  requireStudent,
  validate(staffFeedbackSchema),
  async (req, res, next) => {
    try {
      const { staff_id, rating, comment } = req.body;
      const student_id = req.user.id;

      // Check staff exists in staff_members table
      const { data: staff, error: staffError } = await supabaseAdmin
        .from('staff_members')
        .select('id')
        .eq('id', staff_id)
        .single();

      if (staffError || !staff) {
        return res.status(404).json({ success: false, error: 'Staff member not found' });
      }

      // Check student hasn't already reviewed this staff member today
      const today = new Date().toISOString().split('T')[0];
      const { data: existingReview, error: reviewError } = await supabaseAdmin
        .from('staff_feedback')
        .select('id')
        .eq('staff_id', staff_id)
        .eq('student_id', student_id)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lte('created_at', `${today}T23:59:59.999Z`);

      if (reviewError) throw reviewError;

      if (existingReview && existingReview.length > 0) {
        return res
          .status(400)
          .json({ success: false, error: 'You have already reviewed this staff member today' });
      }

      // Insert into staff_feedback
      const { data: record, error: insertError } = await supabaseAdmin
        .from('staff_feedback')
        .insert({
          staff_id,
          student_id,
          rating,
          comment,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      logger.info(`Staff feedback submitted by student ${student_id} for staff ${staff_id}`);
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
