/**
 * @file apps/server/src/routes/notices.js
 * Express route handlers managing notices operations and database queries.
 */

import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireWarden } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { noticeSchema } from '../config/validation.js';
import logger from '../config/logger.js';
import { getCache, setCache, deleteCache } from '../config/redis.js';
import { createNotification } from '../config/notify.js';
import { auditLog } from '../config/audit.js';
import { emitToAll } from '../config/socket.js';

const router = Router();

/**
 * POST /api/v1/notices
 * Creates a new notice announcement record.
 * Restricted to Wardens. Performs bulk notification insertion for the target audience
 * (students, parents, or all) and invalidates role-specific notices cache keys.
 */
router.post('/', authenticate, requireWarden, validate(noticeSchema), async (req, res, next) => {
  try {
    const { title, content, target_audience } = req.body;

    const { data: record, error } = await supabaseAdmin
      .from('notices')
      .insert({
        posted_by: req.user.id,
        title,
        content,
        target_audience,
      })
      .select()
      .single();

    if (error) {throw error;}

    logger.info(`Notice "${title}" posted by ${req.user.id}`);
    await auditLog(req.user.id, 'post_notice', 'notice', record.id);

    let targetRoles = [];
    if (target_audience === 'all') {targetRoles = ['student', 'parent'];}
    else if (target_audience === 'students') {targetRoles = ['student'];}
    else if (target_audience === 'parents') {targetRoles = ['parent'];}

    if (targetRoles.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('role', targetRoles);

      if (users && users.length > 0) {
        // Run bulk notifications concurrently to prevent blocking the response
        await Promise.all(
          users.map((u) =>
            createNotification(u.id, 'New Notice: ' + title, title, 'notice', record.id)
          )
        );
      }
    }

    await deleteCache('notices:student');
    await deleteCache('notices:parent');
    await deleteCache('notices:warden');
    await deleteCache('stats:dashboard');

    emitToAll('notice:new', { title, target_audience });

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const role = req.profile.role;
    const search = req.query.search?.trim();
    const cacheKey = `notices:${role}`;

    if (!search) {
      const cached = await getCache(cacheKey);
      if (cached) {
        logger.info(`Cache hit: notices ${role}`);
        return res.json({ success: true, data: cached });
      }
      logger.info(`Cache miss: notices ${role}`);
    }

    let query = supabaseAdmin.from('notices').select('*');

    if (role === 'student') {
      query = query.in('target_audience', ['students', 'all']);
    } else if (role === 'parent') {
      query = query.in('target_audience', ['parents', 'all']);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

    if (error) {throw error;}

    if (!search) {
      await setCache(cacheKey, data, 180);
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
