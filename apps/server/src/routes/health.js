import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { redis } from '../config/redis.js';

const router = Router();

router.get('/', async (req, res) => {
  const start = Date.now();
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) {dbStatus = 'degraded';}
  } catch (err) {
    dbStatus = 'degraded';
  }

  try {
    await redis.ping();
  } catch (err) {
    redisStatus = 'degraded';
  }

  const responseTime = Date.now() - start;

  const memoryUsage = process.memoryUsage();

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.json({
    status: dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
    },
    responseTime: `${responseTime}ms`,
  });
});

export default router;
