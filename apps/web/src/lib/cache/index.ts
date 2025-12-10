/**
 * Edge-compatible Cache with Redis Cloud Backend
 * 
 * Provides a unified caching interface that works in both Edge and Node.js runtimes.
 * Falls back to in-memory caching when Redis is unavailable.
 */

import { cache, CacheKeys, CacheTTL, isRedisAvailable } from './redis-client';

// In-memory fallback cache
const memoryCache = new Map<string, { value: unknown; expires: number }>();

/**
 * Clean expired entries from memory cache
 */
function cleanMemoryCache(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expires < now) {
      memoryCache.delete(key);
    }
  }
}

// Clean memory cache every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanMemoryCache, 5 * 60 * 1000);
}

/**
 * Edge-compatible cache wrapper
 * Automatically falls back to in-memory cache when Redis is unavailable
 */
export const edgeCache = {
  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first
    try {
      const redisAvailable = await isRedisAvailable();
      if (redisAvailable) {
        return await cache.get<T>(key);
      }
    } catch {
      // Redis unavailable, fall through to memory cache
    }

    // Fallback to memory cache
    const entry = memoryCache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.value as T;
    }
    memoryCache.delete(key);
    return null;
  },

  /**
   * Set a cached value with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<boolean> {
    // Try Redis first
    try {
      const redisAvailable = await isRedisAvailable();
      if (redisAvailable) {
        return await cache.set(key, value, ttlSeconds);
      }
    } catch {
      // Redis unavailable, fall through to memory cache
    }

    // Fallback to memory cache
    memoryCache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
    return true;
  },

  /**
   * Delete a cached value
   */
  async del(key: string): Promise<boolean> {
    // Try Redis
    try {
      const redisAvailable = await isRedisAvailable();
      if (redisAvailable) {
        return await cache.del(key);
      }
    } catch {
      // Redis unavailable
    }

    // Also delete from memory cache
    memoryCache.delete(key);
    return true;
  },

  /**
   * Increment a counter (rate limiting)
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const redisAvailable = await isRedisAvailable();
      if (redisAvailable) {
        return await cache.incr(key, ttlSeconds);
      }
    } catch {
      // Redis unavailable
    }

    // Fallback to memory cache
    const entry = memoryCache.get(key);
    const currentValue = entry && entry.expires > Date.now() ? (entry.value as number) : 0;
    const newValue = currentValue + 1;
    
    memoryCache.set(key, {
      value: newValue,
      expires: Date.now() + (ttlSeconds || 60) * 1000,
    });
    
    return newValue;
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const redisAvailable = await isRedisAvailable();
      if (redisAvailable) {
        return await cache.exists(key);
      }
    } catch {
      // Redis unavailable
    }

    const entry = memoryCache.get(key);
    return !!(entry && entry.expires > Date.now());
  },
};

export { CacheKeys, CacheTTL };
export default edgeCache;
