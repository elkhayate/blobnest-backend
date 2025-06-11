import redis from '../config/redis';
import logger from '../config/logger';

export async function testRedisConnection() {
  try {
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    await redis.del('test-key');
    
    if (value === 'test-value') {
      logger.info('✅ Redis connection test passed');
      return true;
    } else {
      logger.error('❌ Redis connection test failed: value mismatch');
      return false;
    }
  } catch (error) {
    logger.error('❌ Redis connection test failed:', error);
    return false;
  }
}

if (require.main === module) {
  testRedisConnection();
} 