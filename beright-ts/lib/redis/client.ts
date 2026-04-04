/**
 * Upstash Redis Client
 *
 * Unified Redis client for BeRight using Upstash REST API.
 * Used for:
 * - Session management (30min TTL)
 * - Job queue persistence
 * - Rate limiting (existing)
 *
 * Falls back gracefully to in-memory when Redis unavailable.
 */

import { secrets } from '../secrets';

// ============================================
// TYPES
// ============================================

export interface RedisConfig {
  url: string;
  token: string;
}

export type RedisValue = string | number | null;

// ============================================
// CLIENT
// ============================================

class UpstashRedisClient {
  private config: RedisConfig | null = null;
  private available = false;
  private lastError: string | null = null;

  constructor() {
    this.init();
  }

  private init() {
    const creds = secrets.getUpstashCredentials();
    if (creds) {
      this.config = {
        url: creds.url,
        token: creds.token,
      };
      this.available = true;
      console.log('[Redis] Upstash client initialized');
    } else {
      console.warn('[Redis] Upstash not configured - using in-memory fallback');
    }
  }

  get isAvailable(): boolean {
    return this.available;
  }

  /**
   * Execute a Redis command via REST API
   */
  private async execute<T = unknown>(command: (string | number)[]): Promise<T | null> {
    if (!this.config) {
      throw new Error('Redis not configured');
    }

    try {
      const response = await fetch(`${this.config.url}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Redis error: ${response.status}`);
      }

      const data = await response.json();
      return data.result as T;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Redis] Command failed:', this.lastError);
      throw error;
    }
  }

  /**
   * Execute multiple commands in a pipeline
   */
  private async pipeline<T = unknown>(commands: (string | number)[][]): Promise<T[]> {
    if (!this.config) {
      throw new Error('Redis not configured');
    }

    try {
      const response = await fetch(`${this.config.url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Redis pipeline error: ${response.status}`);
      }

      const results = await response.json();
      return results.map((r: { result: T }) => r.result);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Redis] Pipeline failed:', this.lastError);
      throw error;
    }
  }

  // ============================================
  // KEY-VALUE OPERATIONS
  // ============================================

  /**
   * Get a string value
   */
  async get(key: string): Promise<string | null> {
    return this.execute<string>(['GET', key]);
  }

  /**
   * Set a string value with optional TTL
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.execute(['SET', key, value, 'EX', ttlSeconds]);
    } else {
      await this.execute(['SET', key, value]);
    }
  }

  /**
   * Set a value only if it doesn't exist
   */
  async setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (ttlSeconds) {
      const result = await this.execute<string>(['SET', key, value, 'NX', 'EX', ttlSeconds]);
      return result === 'OK';
    }
    const result = await this.execute<number>(['SETNX', key, value]);
    return result === 1;
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    await this.execute(['DEL', key]);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.execute<number>(['EXISTS', key]);
    return result === 1;
  }

  /**
   * Set TTL on existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.execute(['EXPIRE', key, ttlSeconds]);
  }

  /**
   * Get TTL remaining
   */
  async ttl(key: string): Promise<number> {
    return (await this.execute<number>(['TTL', key])) ?? -2;
  }

  // ============================================
  // JSON OPERATIONS (using string serialization)
  // ============================================

  /**
   * Get a JSON value
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a JSON value
   */
  async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // ============================================
  // HASH OPERATIONS
  // ============================================

  /**
   * Get all fields of a hash
   */
  async hgetall(key: string): Promise<Record<string, string> | null> {
    const result = await this.execute<string[]>(['HGETALL', key]);
    if (!result || result.length === 0) return null;

    const hash: Record<string, string> = {};
    for (let i = 0; i < result.length; i += 2) {
      hash[result[i]] = result[i + 1];
    }
    return hash;
  }

  /**
   * Set multiple hash fields
   */
  async hset(key: string, fields: Record<string, string | number>): Promise<void> {
    const args: (string | number)[] = ['HSET', key];
    for (const [field, value] of Object.entries(fields)) {
      args.push(field, value);
    }
    await this.execute(args);
  }

  /**
   * Get a hash field
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.execute<string>(['HGET', key, field]);
  }

  /**
   * Delete hash fields
   */
  async hdel(key: string, ...fields: string[]): Promise<void> {
    await this.execute(['HDEL', key, ...fields]);
  }

  // ============================================
  // SORTED SET OPERATIONS (for job queue)
  // ============================================

  /**
   * Add to sorted set
   */
  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.execute(['ZADD', key, score, member]);
  }

  /**
   * Get members by score range
   */
  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
    limit?: number
  ): Promise<string[]> {
    const args: (string | number)[] = ['ZRANGEBYSCORE', key, min, max];
    if (limit) {
      args.push('LIMIT', 0, limit);
    }
    return (await this.execute<string[]>(args)) ?? [];
  }

  /**
   * Remove members by score range
   */
  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<void> {
    await this.execute(['ZREMRANGEBYSCORE', key, min, max]);
  }

  /**
   * Remove specific member
   */
  async zrem(key: string, member: string): Promise<void> {
    await this.execute(['ZREM', key, member]);
  }

  /**
   * Get set cardinality
   */
  async zcard(key: string): Promise<number> {
    return (await this.execute<number>(['ZCARD', key])) ?? 0;
  }

  // ============================================
  // LIST OPERATIONS
  // ============================================

  /**
   * Push to left of list
   */
  async lpush(key: string, ...values: string[]): Promise<void> {
    await this.execute(['LPUSH', key, ...values]);
  }

  /**
   * Pop from right of list
   */
  async rpop(key: string): Promise<string | null> {
    return this.execute<string>(['RPOP', key]);
  }

  /**
   * Get list range
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return (await this.execute<string[]>(['LRANGE', key, start, stop])) ?? [];
  }

  /**
   * Trim list to range
   */
  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.execute(['LTRIM', key, start, stop]);
  }

  /**
   * Get list length
   */
  async llen(key: string): Promise<number> {
    return (await this.execute<number>(['LLEN', key])) ?? 0;
  }

  // ============================================
  // UTILITY
  // ============================================

  /**
   * Find keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    return (await this.execute<string[]>(['KEYS', pattern])) ?? [];
  }

  /**
   * Scan keys (cursor-based, safer for large datasets)
   */
  async scan(cursor: number, pattern: string, count = 100): Promise<{ cursor: number; keys: string[] }> {
    const result = await this.execute<[string, string[]]>(['SCAN', cursor, 'MATCH', pattern, 'COUNT', count]);
    if (!result) return { cursor: 0, keys: [] };
    return {
      cursor: parseInt(result[0], 10),
      keys: result[1],
    };
  }

  /**
   * Get server info
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.execute<string>(['PING']);
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const redis = new UpstashRedisClient();

export default redis;
