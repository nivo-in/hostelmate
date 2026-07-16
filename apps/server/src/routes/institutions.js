import { Router } from 'express';
import { searchInstitutions, institutionCount } from '../config/institutions.js';
import { getCache, setCache } from '../config/redis.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * GET /api/v1/institutions/search?q=...&limit=8
 *
 * Public, read-only autocomplete for the demo / onboarding flows. Results are
 * cached in Redis for a day keyed by the normalized query — institution data is
 * effectively static, so this collapses repeat keystroke traffic.
 */
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q?.toString() || '';
    const limit = parseInt(req.query.limit?.toString() || '8', 10);
    
    if (q.trim().length < 2) {
      return res.json({ success: true, results: [], metadata: { count: institutionCount } });
    }

    const cacheKey = `inst:search:v2:${q.toLowerCase().trim()}:${limit}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, results: cached, metadata: { count: institutionCount, cached: true } });
    }

    const results = searchInstitutions(q, limit);

    // Supplement with Hipolabs API to reach 50k+ colleges
    if (results.length < limit) {
      try {
        const hipoRes = await fetch(`http://universities.hipolabs.com/search?country=India&name=${encodeURIComponent(q)}`);
        if (hipoRes.ok) {
          const hipoData = await hipoRes.json();
          const existingNames = new Set(results.map((r) => r.name.toLowerCase()));
          
          for (const item of hipoData) {
            if (results.length >= limit) {break;}
            if (!existingNames.has(item.name.toLowerCase())) {
              results.push({
                name: item.name,
                city: item['state-province'] || 'India',
                state: item['state-province'] || '',
                type: 'University',
              });
              existingNames.add(item.name.toLowerCase());
            }
          }
        }
      } catch (err) {
        logger.warn(`Hipolabs API fetch failed: ${err.message}`);
      }
    }
    await setCache(cacheKey, results, 86400); // 1 day cache

    res.json({ success: true, results, metadata: { count: institutionCount, cached: false } });
  } catch (error) {
    logger.error('Error searching institutions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;