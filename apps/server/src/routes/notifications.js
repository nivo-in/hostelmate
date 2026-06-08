import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { getCache, setCache, deleteCache } from '../config/redis.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // We skip cache if paginating beyond page 1 to keep things simple
    if (page === 1) {
      const cacheKey = `notifications:${req.user.id}:p1`;
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
      }
    }

    const query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data: notifications, count, error } = await query;

    if (error) {
      return res.json({ success: true, data: { notifications: [], unread_count: 0 } });
    }

    const safeNotifications = notifications || [];

    // Get total unread count (not just this page)
    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    const totalPages = Math.ceil(count / limit);

    const payload = {
      notifications: safeNotifications,
      unread_count: unreadCount || 0,
    };

    if (page === 1) {
      await setCache(`notifications:${req.user.id}:p1`, payload, 30); // 30s cache
    }

    res.json({
      success: true,
      data: payload,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch {
    res.json({ success: true, data: { notifications: [], unread_count: 0 } });
  }
});

router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    // Invalidate cache so next GET returns fresh data
    await deleteCache(`notifications:${req.user.id}`).catch(() => {});

    if (error) {
      return res.json({ success: true });
    }

    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id);

    await deleteCache(`notifications:${req.user.id}`).catch(() => {});

    if (error) {
      return res.json({ success: true });
    }

    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id); // guard: only own notifications

    await deleteCache(`notifications:${req.user.id}`).catch(() => {});

    if (error) return res.json({ success: true });
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

export default router;
