import Redis from 'ioredis';
import { appConfig } from '../config/app.config';
import logger from '../utils/logger';

export const redis = new Redis(appConfig.redis.url, {
  retryStrategy: (times: number) => {
    if (times > 3) {
      logger.error('Redis connection failed after 3 retries');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (err: Error) => {
  logger.error('Redis error:', err.message);
});

export const closeRedis = async (): Promise<void> => {
  await redis.quit();
};

export default redis;
