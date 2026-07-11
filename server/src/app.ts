import 'dotenv/config';
import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { appConfig } from './config/app.config';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { apiRateLimiter } from './middlewares/rateLimiter';
import { requestId } from './middlewares/requestId';
import { asyncHandler } from './utils/asyncHandler';
import { checkDatabaseHealth } from './database';
import { redis } from './database/redis';
import { openApiSpec } from './docs/openapi';
import logger from './utils/logger';

const app = express();

// Correlation IDs first, so every downstream log line and response carries one.
app.use(requestId);
morgan.token('id', (req) => (req as Request).id);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: appConfig.isProduction ? appConfig.clientUrl : true,
    credentials: true,
  }),
);

// Rate limiting
app.use(apiRateLimiter);

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Logging
app.use(
  morgan(appConfig.isProduction ? 'combined :id' : 'dev :id', {
    stream: {
      write: (message: string) => {
        logger.http(message.trim());
      },
    },
  }),
);

// Liveness probe — process is up (no external dependency checks).
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: appConfig.env,
  });
});

// Readiness probe — verifies the database and Redis are actually reachable.
app.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const checks = { database: false, redis: false };

    try {
      checks.database = await checkDatabaseHealth();
    } catch {
      checks.database = false;
    }

    try {
      checks.redis = (await redis.ping()) === 'PONG';
    } catch {
      checks.redis = false;
    }

    const ready = checks.database && checks.redis;
    res.status(ready ? 200 : 503).json({
      success: ready,
      message: ready ? 'Ready' : 'Not ready',
      checks,
    });
  }),
);

// API documentation (interactive UI + raw spec).
app.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// API routes
app.use(routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use(errorHandler);

export default app;
