import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireStudent, requireWarden } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { messMenuSchema, messReviewSchema } from '../config/validation.js';
import logger from '../config/logger.js';
import { getCache, setCache, deleteCache } from '../config/redis.js';

const router = Router();

router.get('/menu', authenticate, async (req, res, next) => {
  try {
    const cacheKey = 'mess:menu';
    const cached = await getCache(cacheKey);
    if (cached) {
      logger.info('Cache hit: mess menu');
      return res.json({ success: true, data: cached });
    }
    logger.info('Cache miss: mess menu');

    const { data, error } = await supabaseAdmin.from('mess_menu').select('*').order('day_of_week');

    if (error) {throw error;}

    await setCache(cacheKey, data, 3600);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.put(
  '/menu',
  authenticate,
  requireWarden,
  validate(messMenuSchema),
  async (req, res, next) => {
    try {
      const { day_of_week, meal_type, items } = req.body;

      const { data, error } = await supabaseAdmin
        .from('mess_menu')
        .upsert({ day_of_week, meal_type, items }, { onConflict: 'day_of_week,meal_type' })
        .select()
        .single();

      if (error) {throw error;}

      logger.info(`Mess menu updated for ${day_of_week} ${meal_type} by ${req.user.id}`);

      await deleteCache('mess:menu');
      await deleteCache('stats:dashboard');

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/review',
  authenticate,
  requireStudent,
  validate(messReviewSchema),
  async (req, res, next) => {
    try {
      const { meal_type, date, rating, comments } = req.body;

      const { data, error } = await supabaseAdmin
        .from('mess_reviews')
        .upsert(
          {
            student_id: req.user.id,
            meal_type,
            date,
            rating,
            comments,
          },
          { onConflict: 'student_id,date,meal_type' }
        )
        .select()
        .single();

      if (error) {throw error;}

      logger.info(`Mess review submitted by ${req.user.id} for ${meal_type} on ${date}`);

      await deleteCache('mess:reviews');
      await deleteCache('stats:dashboard');

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/reviews', authenticate, requireWarden, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const cacheKey = `mess:reviews:limit:${limit}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      logger.info('Cache hit: mess reviews');
      return res.json({ success: true, data: cached });
    }
    logger.info('Cache miss: mess reviews');

    const { data, error } = await supabaseAdmin
      .from('mess_reviews')
      .select(
        `
    *,
    students!mess_reviews_student_id_fkey (
      roll_number,
      profiles!students_id_fkey (
        full_name
      )
    )
  `
      )
      .limit(limit)
      .order('date', { ascending: false });

    if (error) {throw error;}

    // Calculate averages
    const averages = data.reduce((acc, review) => {
      if (!acc[review.meal_type]) {
        acc[review.meal_type] = { totalRating: 0, count: 0 };
      }
      acc[review.meal_type].totalRating += review.rating;
      acc[review.meal_type].count += 1;
      return acc;
    }, {});

    Object.keys(averages).forEach((meal_type) => {
      const avg = averages[meal_type].totalRating / averages[meal_type].count;
      averages[meal_type] = Number(avg.toFixed(1));
    });

    const responseData = { reviews: data, averages };
    await setCache(cacheKey, responseData, 300);
    res.json({ success: true, data: responseData });
  } catch (error) {
    next(error);
  }
});

export default router;
