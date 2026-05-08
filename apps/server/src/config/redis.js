import dotenv from 'dotenv'
dotenv.config()

import { Redis } from '@upstash/redis'
import logger from './logger.js'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

export async function getCache(key) {
  try {
    return await redis.get(key)
  } catch (error) {
    logger.error(`Redis get error: ${error.message}`)
    return null
  }
}

export async function setCache(key, value, ttlSeconds = 300) {
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch (error) {
    logger.error(`Redis set error: ${error.message}`)
  }
}

export async function deleteCache(key) {
  try {
    await redis.del(key)
  } catch (error) {
    logger.error(`Redis del error: ${error.message}`)
  }
}

export async function deleteCachePattern(pattern) {
  try {
    const keys = await redis.keys(pattern)
    if (keys && keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    logger.error(`Redis del pattern error: ${error.message}`)
  }
}
