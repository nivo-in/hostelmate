import dotenv from 'dotenv';
dotenv.config();

import { Redis } from '@upstash/redis';
import logger from './logger.js';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Retrieves a parsed value from Redis cache by key.
 *
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null if missed/failed
 */
export async function getCache(key) {
  try {
    return await redis.get(key);
  } catch (error) {
    logger.error(`Redis get error: ${error.message}`);
    return null;
  }
}

/**
 * Sets a value in the Redis cache with a configurable TTL.
 *
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} [ttlSeconds=300] - Expiry TTL in seconds
 * @returns {Promise<void>}
 */
export async function setCache(key, value, ttlSeconds = 300) {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    logger.error(`Redis set error: ${error.message}`);
  }
}

/**
 * Removes a specific key from the cache.
 *
 * @param {string} key - Cache key to remove
 * @returns {Promise<void>}
 */
export async function deleteCache(key) {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error(`Redis del error: ${error.message}`);
  }
}

/**
 * Scans keys matching a glob pattern and deletes them from cache.
 * Used for smart bulk cache invalidation (e.g. notices:*).
 *
 * @param {string} pattern - Glob matching pattern
 * @returns {Promise<void>}
 */
export async function deleteCachePattern(pattern) {
  try {
    const keys = await redis.keys(pattern);
    if (keys && keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.error(`Redis del pattern error: ${error.message}`);
  }
}

/**
 * Publish an event to a Redis channel (Upstash Pub/Sub).
 * @param {string} channel
 * @param {object} data
 */
export async function publishEvent(channel, data) {
  try {
    await redis.publish(channel, JSON.stringify(data));
  } catch (err) {
    logger.warn('Redis publish failed', { error: err.message });
  }
}
