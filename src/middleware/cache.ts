import { Request, Response, NextFunction } from 'express';
import redis, { trackCacheKey } from '../config/redis';
import logger from '../config/logger';

export interface CacheOptions {
  ttl?: number;  
  keyGenerator?: (req: Request) => string;
  category?: 'users' | 'containers' | 'files' | 'dashboard' | 'auditLogs';
}

export function cache(cacheKey: string | ((req: Request) => string), options: CacheOptions = {}) {
  const { ttl = 300, category } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const key = typeof cacheKey === 'function' ? cacheKey(req) : cacheKey;
      
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        logger.info(`🎯 Cache hit for key: ${key}`);
        try {
          const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
          return res.json(parsedData);
        } catch (error) {
          logger.error(`❌ Failed to parse cached data for key ${key}:`, error);
        }
      }

      logger.info(`🔍 Cache miss for key: ${key}`);

      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis.set(key, JSON.stringify(data), { ex: ttl }).catch((error) => {
            logger.error(`❌ Failed to cache data for key ${key}:`, error);
          });
          
          if (category) {
            trackCacheKey(key, category).catch((error) => {
              logger.warn(`⚠️ Failed to track cache key ${key}:`, error);
            });
          }
          
          logger.info(`💾 Cached response for key: ${key} (TTL: ${ttl}s) [Category: ${category || 'unknown'}]`);
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('❌ Cache middleware error:', error);
      next();
    }
  };
}

export function generateCacheKeyWithQuery(baseKey: string) {
  return (req: Request): string => {
    const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
    return queryParams ? `${baseKey}:${queryParams}` : baseKey;
  };
}

export function generateUserCacheKey(baseKey: string) {
  return (req: Request): string => {
    const userId = (req as any).user?.id || 'anonymous';
    const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
    return queryParams ? `${baseKey}:${userId}:${queryParams}` : `${baseKey}:${userId}`;
  };
} 