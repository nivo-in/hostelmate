import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireStudent } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { lostFoundSchema } from '../config/validation.js';
import logger from '../config/logger.js';
import { findMatches } from '../config/matcher.js';
import { notifyLostFoundMatch } from '../config/notifications.js';
import { deleteCache } from '../config/redis.js';

const router = Router();

router.post(
  '/',
  authenticate,
  requireStudent,
  validate(lostFoundSchema),
  async (req, res, next) => {
    try {
      const { item_name, description, status, location_found } = req.body;

      const { data: record, error } = await supabaseAdmin
        .from('lost_and_found')
        .insert({
          reported_by: req.user.id,
          item_name,
          description,
          location_found,
          status: status || 'lost',
          date_reported: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`Lost/found item "${item_name}" reported by ${req.user.id}`);

      try {
        const oppositeStatus = record.status === 'lost' ? 'found' : 'lost';
        const { data: existingItems } = await supabaseAdmin
          .from('lost_and_found')
          .select('*')
          .eq('status', oppositeStatus)
          // .is('deleted_at', null)
          .neq('id', record.id);

        if (existingItems && existingItems.length > 0) {
          const matches = findMatches(record, existingItems, 0.25);

          if (matches.length > 0) {
            const bestMatch = matches[0];
            logger.info(`Lost & Found match found — Score: ${Math.round(bestMatch.score * 100)}%`);

            await notifyLostFoundMatch(
              record.reported_by,
              bestMatch.item.reported_by,
              record,
              bestMatch.item,
              bestMatch.score
            );

            await deleteCache('lost-found:all');
            return res.json({
              success: true,
              data: record,
              match: {
                found: true,
                item: bestMatch.item,
                confidence: Math.round(bestMatch.score * 100),
              },
            });
          }
        }
      } catch (matchErr) {
        logger.warn('Match finding failed', { error: matchErr.message });
      }

      await deleteCache('lost-found:all');
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('lost_and_found')
      .select(
        `
    *,
    students!lost_and_found_reported_by_fkey (
      roll_number,
      profiles!students_id_fkey (
        full_name
      )
    )
  `,
        { count: 'exact' }
      )
      // .is('deleted_at', null)
      .order('status', { ascending: false })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(from, to);

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

router.patch('/:id/claim', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('lost_and_found')
      .update({ status: 'claimed' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Lost/found item ${id} claimed/resolved by ${req.user.id}`);
    await deleteCache('lost-found:all');
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
      .from('lost_and_found')
      .delete()
      .eq('id', id)
      .eq('reported_by', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
