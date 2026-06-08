import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireWarden } from '../middleware/rbac.js';

const router = Router();

router.get('/', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { resource, action } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('audit_logs')
      .select(
        `
        *,
        profiles!audit_logs_user_id_fkey(full_name)
      `, { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (resource) {
      query = query.eq('resource', resource);
    }

    if (action) {
      query = query.ilike('action', `%${action}%`);
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
        hasPrev: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
