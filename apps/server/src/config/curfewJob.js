import { supabaseAdmin } from './supabase.js';
import { redis } from './redis.js';
import logger from './logger.js';
import { createNotification } from './notify.js';

let curfewInterval = null;

export const startCurfewJob = () => {
  if (curfewInterval) {return;}
  // Check every minute
  curfewInterval = setInterval(async () => {
    try {
      const now = new Date();
      // Use IST for curfew checking
      const currentTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      let settings = { curfew_time: '22:00', enabled: true };
      try {
        const cached = await redis.get('curfew:settings');
        if (cached) {settings = JSON.parse(cached);}
      } catch (e) {
        // ignore
      }

      if (!settings.enabled) {return;}

      const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
      const cacheKey = `curfew_notified:${today}:${settings.curfew_time}`;

      // If we are past curfew and haven't notified today
      if (currentTimeStr >= settings.curfew_time) {
        const alreadyNotified = await redis.get(cacheKey);
        if (alreadyNotified) {return;}

        // Mark as notified for today (expires in 24 hours)
        await redis.set(cacheKey, 'true', { ex: 86400 });

        logger.info(`Curfew time (${settings.curfew_time}) hit. Checking violations...`);

        const { data: students, error: studentsError } = await supabaseAdmin
          .from('students')
          .select('id, profiles!students_id_fkey(full_name)');

        if (studentsError) {throw studentsError;}

        const { data: attendance, error: attendanceError } = await supabaseAdmin
          .from('attendance')
          .select('student_id')
          .eq('date', today)
          .eq('status', 'present');

        if (attendanceError) {throw attendanceError;}

        const presentStudentIds = new Set(attendance.map((a) => a.student_id));
        const violations = students.filter((s) => !presentStudentIds.has(s.id));

        if (violations.length > 0) {
          const studentNames = violations.map((s) => s.profiles?.full_name || 'Unknown').join(', ');
          const message = `${violations.length} student(s) (${studentNames}) have not checked in by curfew time (${settings.curfew_time}).`;

          // Fetch all wardens
          const { data: wardens } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .in('role', ['warden', 'admin']);

          if (wardens) {
            for (const warden of wardens) {
              await createNotification(warden.id, 'Curfew Alert', message, 'notice');
            }
          }
          logger.info(`Curfew job completed: ${violations.length} violations recorded and wardens notified.`);
        } else {
          logger.info('Curfew job completed: 0 violations. All students are present.');
        }
      }
    } catch (err) {
      logger.error('Error in curfew job:', err);
    }
  }, 60 * 1000); // 1 minute
};

export const stopCurfewJob = () => {
  if (curfewInterval) {
    clearInterval(curfewInterval);
    curfewInterval = null;
  }
};
