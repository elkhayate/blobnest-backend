import { Redis } from '@upstash/redis';
import logger from './logger';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

redis.ping().then(() => {
  logger.info('✅ Redis connection established');
}).catch((error) => {
  logger.error('❌ Redis connection failed:', error);
});

export const cacheKeys = {
  users: {
    all: 'users:all',
    userAndCompany: (userId: string) => `users:${userId}:company-info`,
  },
  containers: {
    all: 'containers:all',
    byUser: (userId: string) => `containers:user:${userId}`,
  },
  files: {
    all: 'files:all',
    byContainer: (containerName: string) => `files:container:${containerName}`,
    byUser: (userId: string) => `files:user:${userId}`,
  },
  dashboard: {
    stats: (timeRange: string) => `dashboard:stats:${timeRange}`,
    storageMetrics: (timeRange: string) => `dashboard:storage:${timeRange}`,
    containerMetrics: (containerName: string, timeRange: string) => `dashboard:container:${containerName}:${timeRange}`,
  },
  auditLogs: {
    all: 'audit-logs:all',
    byUser: (userId: string) => `audit-logs:user:${userId}`,
  }
};

const CACHE_KEY_SETS = {
  users: 'cache:keys:users',
  containers: 'cache:keys:containers', 
  files: 'cache:keys:files',
  dashboard: 'cache:keys:dashboard',
  auditLogs: 'cache:keys:audit-logs'
};

export async function trackCacheKey(key: string, category: keyof typeof CACHE_KEY_SETS) {
  try {
    await redis.sadd(CACHE_KEY_SETS[category], key);
  } catch (error) {
    logger.warn(`⚠️ Failed to track cache key ${key}:`, error);
  }
}

export const invalidateCache = {
  users: async () => {
    await invalidateTrackedKeys('users');
  },
  
  containers: async () => {
    await invalidateTrackedKeys('containers');
    await invalidateTrackedKeys('files');  
    await invalidateTrackedKeys('dashboard');  
  },
  
  files: async (containerName?: string) => {
    if (containerName) {
      await invalidateKeysContaining(`files:container:${containerName}`);
    } else {
      await invalidateTrackedKeys('files');
    }
    await invalidateTrackedKeys('dashboard');  
  },
  
  dashboard: async () => {
    await invalidateTrackedKeys('dashboard');
  },
  
  auditLogs: async () => {
    await invalidateTrackedKeys('auditLogs');
  },

  clearAll: async () => {
    try {
      const categories = Object.keys(CACHE_KEY_SETS) as (keyof typeof CACHE_KEY_SETS)[];
      for (const category of categories) {
        await invalidateTrackedKeys(category);
      }
      
      await redis.del(...Object.values(CACHE_KEY_SETS));
      
      logger.info('🧹 All cache and tracking keys cleared');
    } catch (error) {
      logger.error('❌ Failed to clear all cache:', error);
    }
  }
};

async function invalidateTrackedKeys(category: keyof typeof CACHE_KEY_SETS) {
  try {
    const setKey = CACHE_KEY_SETS[category];
    const keys = await redis.smembers(setKey);
    
    if (keys && keys.length > 0) {
      const deletePromises = keys.map(key => redis.del(key));
      await Promise.all(deletePromises);
      
      await redis.del(setKey);
      
      logger.info(`🗑️ Invalidated ${keys.length} tracked keys for category: ${category}`);
      logger.info(`🗑️ Invalidated keys: ${keys.join(', ')}`);
    } else {
      logger.info(`🗑️ No tracked keys found for category: ${category}`);
    }
  } catch (error) {
    logger.error(`❌ Failed to invalidate tracked keys for ${category}:`, error);
  }
}

async function invalidateKeysContaining(pattern: string) {
  try {
    const categories = Object.keys(CACHE_KEY_SETS) as (keyof typeof CACHE_KEY_SETS)[];
    let deletedCount = 0;
    
    for (const category of categories) {
      const setKey = CACHE_KEY_SETS[category];
      const keys = await redis.smembers(setKey);
      
      if (keys && keys.length > 0) {
        const matchingKeys = keys.filter(key => key.includes(pattern));
        
        if (matchingKeys.length > 0) {
          await Promise.all(matchingKeys.map(key => redis.del(key)));
          
          await redis.srem(setKey, ...matchingKeys);
          
          deletedCount += matchingKeys.length;
          logger.info(`🗑️ Deleted ${matchingKeys.length} keys matching pattern "${pattern}": ${matchingKeys.join(', ')}`);
        }
      }
    }
    
    if (deletedCount === 0) {
      logger.info(`🗑️ No keys found matching pattern: ${pattern}`);
    }
  } catch (error) {
    logger.error(`❌ Failed to invalidate keys containing pattern ${pattern}:`, error);
  }
}

export default redis; 