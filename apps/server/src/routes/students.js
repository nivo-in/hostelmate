import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireWarden } from '../middleware/rbac.js';

const router = Router();

/**
 * GET /api/students
 * Returns all students with their profile info and room assignment.
 * Warden only.
 */
router.get('/', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { search } = req.query;

    const { data, error } = await supabaseAdmin
      .from('students')
      .select(
        `
        id,
        roll_number,
        room_id,
        parent_id,
        created_at,
        profiles!students_id_fkey(full_name, email, phone, avatar_url),
        rooms!students_room_id_fkey(room_number, blocks!rooms_block_id_fkey(name))
      `
      )
      .order('created_at', { ascending: true });

    if (error) {throw error;}

    let students = (data || []).map((s) => ({
      id: s.id,
      roll_number: s.roll_number,
      full_name: s.profiles?.full_name ?? null,
      email: s.profiles?.email ?? null,
      phone: s.profiles?.phone ?? null,
      avatar_url: s.profiles?.avatar_url ?? null,
      room_number: s.rooms?.room_number ?? null,
      block_name: s.rooms?.blocks?.name ?? null,
      room_id: s.room_id,
      parent_id: s.parent_id,
      created_at: s.created_at,
    }));

    if (search) {
      const q = search.toLowerCase();
      students = students.filter(
        (s) =>
          (s.full_name && s.full_name.toLowerCase().includes(q)) ||
          (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.room_number && s.room_number.toLowerCase().includes(q))
      );
    }

    res.json({ success: true, data: { students, total: students.length } });
  } catch (error) {
    next(error);
  }
});

export default router;
