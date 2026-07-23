import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { redis } from '../config/redis.js';

const router = Router();

/**
 * GET /health
 * Returns a structured health check payload including database, Redis,
 * memory, uptime, and response time. Returns HTTP 503 when any service
 * is degraded so load balancers can detect unhealthy instances.
 */
router.get('/', async (req, res) => {
  const start = Date.now();
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) {dbStatus = 'degraded';}
  } catch {
    dbStatus = 'degraded';
  }

  try {
    await redis.ping();
  } catch {
    redisStatus = 'degraded';
  }

  const isHealthy = dbStatus === 'ok' && redisStatus === 'ok';
  const responseTime = Date.now() - start;
  const memoryUsage = process.memoryUsage();

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
    uptime: Math.round(process.uptime()),
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
    },
    responseTime: `${responseTime}ms`,
  });
});

export default router;
