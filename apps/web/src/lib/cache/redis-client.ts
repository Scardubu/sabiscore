/**
 * Redis Client for SabiScore
 * 
 * Provides a singleton Redis connection with automatic reconnection
 * and graceful fallback for edge runtime environments.
 */

import Redis, { RedisOptions } from 'ioredis';

// Redis Cloud configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Connection options optimized for Redis Cloud
const redisOptions: RedisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err: Error) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
  enableReadyCheck: true,
  connectTimeout: 10000,
  lazyConnect: true,
};

// Singleton Redis instance
let redis: Redis | null = null;

/**
 * Get the Redis client instance
 * Creates a new connection if one doesn't exist
 */
export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, redisOptions);

    redis.on('connect', () => {
      console.log('[Redis] Connected to Redis Cloud');
    });

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redis.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });
  }

  return redis;
}

/**
 * Close the Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('[Redis] Connection closed');
  }
}

/**
 * Check if Redis is available and connected
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Cache utility functions
 */
export const cache = {
  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = getRedisClient();
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[Redis] Cache get error:', error);
      return null;
    }
  },

  /**
   * Set a cached value with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const client = getRedisClient();
      await client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('[Redis] Cache set error:', error);
      return false;
    }
  },

  /**
   * Delete a cached value
   */
  async del(key: string): Promise<boolean> {
    try {
      const client = getRedisClient();
      await client.del(key);
      return true;
    } catch (error) {
      console.error('[Redis] Cache del error:', error);
      return false;
    }
  },

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const client = getRedisClient();
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error('[Redis] Cache delPattern error:', error);
      return 0;
    }
  },

  /**
   * Increment a counter
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const client = getRedisClient();
      const value = await client.incr(key);
      if (ttlSeconds) {
        await client.expire(key, ttlSeconds);
      }
      return value;
    } catch (error) {
      console.error('[Redis] Cache incr error:', error);
      return 0;
    }
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = getRedisClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[Redis] Cache exists error:', error);
      return false;
    }
  },

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      const client = getRedisClient();
      return await client.ttl(key);
    } catch (error) {
      console.error('[Redis] Cache ttl error:', error);
      return -1;
    }
  },

  /**
   * Store a hash
   */
  async hset(key: string, field: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    try {
      const client = getRedisClient();
      await client.hset(key, field, JSON.stringify(value));
      if (ttlSeconds) {
        await client.expire(key, ttlSeconds);
      }
      return true;
    } catch (error) {
      console.error('[Redis] Cache hset error:', error);
      return false;
    }
  },

  /**
   * Get a hash field
   */
  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const client = getRedisClient();
      const value = await client.hget(key, field);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[Redis] Cache hget error:', error);
      return null;
    }
  },

  /**
   * Get all hash fields
   */
  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    try {
      const client = getRedisClient();
      const data = await client.hgetall(key);
      if (!data || Object.keys(data).length === 0) return null;
      
      const result: Record<string, T> = {};
      for (const [field, value] of Object.entries(data)) {
        result[field] = JSON.parse(value) as T;
      }
      return result;
    } catch (error) {
      console.error('[Redis] Cache hgetall error:', error);
      return null;
    }
  },
};

// Cache key prefixes for organization
export const CacheKeys = {
  // Odds caching (30 min TTL)
  odds: (matchId: string) => `sabiscore:odds:${matchId}`,
  oddsAll: () => `sabiscore:odds:*`,
  
  // Match data (1 hour TTL)
  match: (matchId: string) => `sabiscore:match:${matchId}`,
  matches: (league: string) => `sabiscore:matches:${league}`,
  
  // Predictions (1 hour TTL)
  prediction: (matchId: string) => `sabiscore:prediction:${matchId}`,
  
  // Rate limiting (1 min TTL)
  rateLimit: (ip: string, endpoint: string) => `sabiscore:ratelimit:${endpoint}:${ip}`,
  
  // API responses (5 min TTL)
  apiResponse: (endpoint: string, params: string) => `sabiscore:api:${endpoint}:${params}`,
  
  // Model warmup status (5 min TTL)
  warmupStatus: () => `sabiscore:warmup:status`,
  
  // Metrics aggregation (1 min TTL)
  metrics: () => `sabiscore:metrics:current`,
  
  // Drift detection (6 hours TTL)
  driftReport: () => `sabiscore:drift:report`,
} as const;

// Default TTL values in seconds
export const CacheTTL = {
  ODDS: 1800,        // 30 minutes
  MATCH: 3600,       // 1 hour
  PREDICTION: 3600,  // 1 hour
  RATE_LIMIT: 60,    // 1 minute
  API_RESPONSE: 300, // 5 minutes
  WARMUP: 300,       // 5 minutes
  METRICS: 60,       // 1 minute
  DRIFT: 21600,      // 6 hours
} as const;

export default cache;
