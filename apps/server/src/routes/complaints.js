import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireStudent, requireWarden } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { complaintSchema } from '../config/validation.js';
import logger from '../config/logger.js';
import { deleteCache, getCache, setCache } from '../config/redis.js';
import { createNotification } from '../config/notify.js';
import { auditLog } from '../config/audit.js';
import { emitToUser } from '../config/socket.js';
import { classifyComplaint, generateMaintenanceSuggestion } from '../config/openai.js';

const router = Router();

router.post(
  '/',
  authenticate,
  requireStudent,
  validate(complaintSchema),
  async (req, res, next) => {
    try {
      const { category, description, is_urgent } = req.body;

      // AI Classification
      let aiResult = null;
      let finalCategory = category;
      let finalUrgency = is_urgent || false;
      let aiSummary = null;
      let aiSuggestedAction = null;

      try {
        aiResult = await classifyComplaint(description);
        if (aiResult && aiResult.confidence > 0.7) {
          // Use AI result if high confidence
          finalCategory = aiResult.category;
          finalUrgency = aiResult.is_urgent;
          aiSummary = aiResult.summary;
          aiSuggestedAction = aiResult.suggested_action;
          logger.info(`AI override — category: ${finalCategory}, urgent: ${finalUrgency}`);
        }
      } catch (err) {
        // Non-critical — continue with user-provided values
        logger.warn('AI classification skipped', { error: err.message });
      }

      const { data: record, error } = await supabaseAdmin
        .from('complaints')
        .insert({
          student_id: req.user.id,
          category: finalCategory,
          description,
          is_urgent: finalUrgency,
          status: 'open',
          ai_summary: aiSummary,
          ai_suggested_action: aiSuggestedAction,
          ai_confidence: aiResult?.confidence || null,
          ai_classified: aiResult !== null,
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`Complaint submitted by user ${req.user.id}`);
      await deleteCache('stats:dashboard');

      res.json({
        success: true,
        data: record,
        ai: aiResult
          ? {
              classified: true,
              category_changed: finalCategory !== category,
              urgency_changed: finalUrgency !== is_urgent,
              summary: aiSummary,
              confidence: aiResult.confidence,
            }
          : { classified: false },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/my', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('student_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/all', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin.from('complaints').select(`
    *,
    students!complaints_student_id_fkey (
      roll_number,
      profiles!students_id_fkey (
        full_name
      )
    )
  `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(from, to).order('created_at', { ascending: false });
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
        hasPrev: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updates = { status };

    if (status === 'resolved') {
      updates.resolved_by = req.user.id;
      updates.resolution_date = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('complaints')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Complaint ${id} status updated to ${status} by ${req.user.id}`);
    await auditLog(req.user.id, 'update_complaint', 'complaint', id);

    if (status === 'resolved') {
      await createNotification(
        data.student_id,
        'Complaint Resolved',
        'Your complaint has been resolved',
        'complaint',
        id
      );
    }
    emitToUser(data.student_id, 'complaint:updated', { id, status });

    await deleteCache('stats:dashboard');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics', authenticate, requireWarden, async (req, res, next) => {
  try {
    const cacheKey = 'complaints:analytics';
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: complaints, error } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (error) throw error;

    const result = await generateMaintenanceSuggestion(complaints);
    if (!result) {
      return res.status(500).json({ success: false, error: 'Failed to generate analytics' });
    }

    const data = {
      patterns: result.patterns,
      summary: result.summary,
      total_complaints: complaints.length,
      by_category: complaints.reduce((acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
      }, {}),
    };

    await setCache(cacheKey, data, 3600);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { data: complaints, error } = await supabaseAdmin
      .from('complaints')
      .select('category, status, is_urgent, created_at, resolution_date');

    if (error) throw error;

    const stats = {
      by_category: {},
      by_status: {},
      by_urgency: { true: 0, false: 0 },
      average_resolution_time_hours: 0,
    };

    let resolvedCount = 0;
    let totalResolutionTime = 0;

    complaints.forEach((c) => {
      stats.by_category[c.category] = (stats.by_category[c.category] || 0) + 1;
      stats.by_status[c.status] = (stats.by_status[c.status] || 0) + 1;
      stats.by_urgency[c.is_urgent] = (stats.by_urgency[c.is_urgent] || 0) + 1;

      if (c.status === 'resolved' && c.resolution_date) {
        const created = new Date(c.created_at);
        const resolved = new Date(c.resolution_date);
        const diffHours = (resolved - created) / (1000 * 60 * 60);
        totalResolutionTime += diffHours;
        resolvedCount++;
      }
    });

    if (resolvedCount > 0) {
      stats.average_resolution_time_hours = Number(
        (totalResolutionTime / resolvedCount).toFixed(2)
      );
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

export default router;
