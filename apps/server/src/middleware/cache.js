import { getCache } from '../config/redis.js'
import logger from '../config/logger.js'

export const cacheMiddleware = (keyFn, ttl = 300) => async (req, res, next) => {
  try {
    const key = typeof keyFn === 'function' ? keyFn(req) : keyFn
    const cached = await getCache(key)
    if (cached) {
      logger.info(`Cache hit: ${key}`)
      return res.json({ success: true, data: cached, cached: true })
    }
    res.locals.cacheKey = key
    res.locals.cacheTTL = ttl
    next()
  } catch (err) {
    next()
  }
}
