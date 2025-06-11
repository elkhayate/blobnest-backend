import { Request, Response, NextFunction } from 'express';
import { invalidateCache } from '../config/redis';
import logger from '../config/logger';

export function invalidateCacheAfter(
  cacheType: 'users' | 'containers' | 'files' | 'dashboard' | 'auditLogs',
  options: { containerName?: string | ((req: Request) => string) } = {}
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let containerName: string | undefined;
        if (options.containerName) {
          containerName = typeof options.containerName === 'function' 
            ? options.containerName(req) 
            : options.containerName;
        }
        
        const invalidatePromise = (async () => {
          try {
            switch (cacheType) {
              case 'users':
                await invalidateCache.users();
                break;
              case 'containers':
                await invalidateCache.containers();
                break;
              case 'files':
                await invalidateCache.files(containerName);
                break;
              case 'dashboard':
                await invalidateCache.dashboard();
                break;
              case 'auditLogs':
                await invalidateCache.auditLogs();
                break;
            }
            logger.info(`🗑️ Cache invalidated for: ${cacheType}`);
          } catch (error) {
            logger.error(`❌ Failed to invalidate ${cacheType} cache:`, error);
          }
        })();
        
        invalidatePromise.catch(() => {});
      }
      
      return originalJson(data);
    };
    
    next();
  };
} 