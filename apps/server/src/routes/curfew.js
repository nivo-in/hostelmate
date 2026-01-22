import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireWarden } from '../middleware/rbac.js';

import { redis } from '../config/redis.js';
import { createNotification } from '../config/notify.js';

const router = Router();

router.get('/violations', authenticate, requireWarden, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    let settings = { curfew_time: '22:00', enabled: true };
    try {
      const cached = await redis.get('curfew:settings');
      if (cached) settings = JSON.parse(cached);
    } catch (e) {
      // ignore
    }

    if (!settings.enabled) {
      return res.json({ success: true, data: [] });
    }

    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });

    if (currentTimeStr <= settings.curfew_time) {
      return res.json({ success: true, data: [] });
    }

    const { data: students, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, roll_number, room_id, profiles!students_id_fkey(full_name)');

    if (studentsError) throw studentsError;

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .select('student_id')
      .eq('date', today)
      .eq('status', 'present');

    if (attendanceError) throw attendanceError;

    const presentStudentIds = new Set(attendance.map((a) => a.student_id));

    const todayKolkata = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const violations = await Promise.all(
      students
        .filter((s) => !presentStudentIds.has(s.id))
        .map(async (s) => {
          const key = `curfew_parent_notified:${todayKolkata}:${s.id}`;
          const isNotified = await redis.get(key);
          return {
            student_id: s.id,
            full_name: s.profiles?.full_name,
            roll_number: s.roll_number,
            room_number: s.room_id,
            parent_notified: !!isNotified,
          };
        })
    );

    res.json({ success: true, data: violations });
  } catch (error) {
    next(error);
  }
});

router.post('/notify', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { student_ids } = req.body;

    if (!Array.isArray(student_ids)) {
      return res.status(400).json({ success: false, error: 'student_ids must be an array' });
    }

    let notified_count = 0;

    const todayKolkata = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    for (const student_id of student_ids) {
      const key = `curfew_parent_notified:${todayKolkata}:${student_id}`;
      const alreadyNotified = await redis.get(key);
      if (alreadyNotified) {
        continue; // Skip if already notified today
      }

      const { data: student } = await supabaseAdmin
        .from('students')
        .select('profiles!students_id_fkey(full_name)')
        .eq('id', student_id)
        .single();

      const name = student?.profiles?.full_name || 'Student';

      // Send to specific parents of this student
      const { data: parentRows } = await supabaseAdmin
        .from('parents')
        .select('id')
        .eq('student_id', student_id);

      if (parentRows && parentRows.length > 0) {
        for (const p of parentRows) {
          await createNotification(
            p.id,
            'Curfew Alert',
            `Your ward ${name} has not checked in by curfew time. Please contact the hostel immediately.`,
            'notice',
            student_id
          );
        }
      }

      // Mark as notified today
      await redis.set(key, 'true', { ex: 86400 });
      notified_count++;
    }

    res.json({ success: true, notified_count });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', authenticate, requireWarden, async (req, res, next) => {
  try {
    let settings = { curfew_time: '22:00', enabled: true };
    try {
      const cached = await redis.get('curfew:settings');
      if (cached) settings = JSON.parse(cached);
    } catch (e) {
      // ignore
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

router.patch('/settings', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { curfew_time, enabled } = req.body;

    const settings = {
      curfew_time: curfew_time || '22:00',
      enabled: enabled !== undefined ? enabled : true,
    };

    await redis.set('curfew:settings', JSON.stringify(settings));

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

export default router;
