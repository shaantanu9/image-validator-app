import app from './app';
import { appConfig } from './config/app.config';
import { connectDatabase, disconnectDatabase } from './database';
import { redis, closeRedis } from './database/redis';
import logger from './utils/logger';

const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    await connectDatabase();

    // Test Redis connection
    await redis.ping();

    const server = app.listen(appConfig.port, () => {
      logger.info(`Server running on port ${appConfig.port} in ${appConfig.env} mode`);
    });

    // Graceful shutdown
    const shutdown = (signal: string): void => {
      logger.info(`${signal} received. Shutting down gracefully...`);

      server.close(() => {
        void (async () => {
          try {
            await disconnectDatabase();
            await closeRedis();
            logger.info('Database and Redis connections closed');
          } catch (error) {
            logger.error('Error during shutdown:', error);
          } finally {
            process.exit(0);
          }
        })();
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    await disconnectDatabase();
    await closeRedis();
    process.exit(1);
  }
};

void startServer();
