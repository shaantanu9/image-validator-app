import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { HTTP_STATUS } from '../constants/httpStatus';
import { MESSAGES } from '../constants/messages';
import { appConfig } from '../config/app.config';
import { redis } from '../database/redis';
import logger from '../utils/logger';

const isProduction = appConfig.isProduction;

// Fail open: if the Redis store errors (e.g. Redis is down), express-rate-limit
// calls next(err), which would otherwise 500 EVERY request. We'd rather serve
// traffic un-throttled than take the whole API down, so we log and continue.
const failOpen =
  (limiter: RequestHandler, name: string): RequestHandler =>
  (req, res, next) => {
    limiter(req, res, (err?: unknown) => {
      if (err) {
        logger.error(`Rate limiter (${name}) store error — failing open`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      next();
    });
  };

// Liveness/readiness probes must never be throttled (a burst of probes from an
// orchestrator would otherwise trip the limit and report the app as unhealthy).
const isProbe = (path: string): boolean => path === '/health' || path === '/ready';

// Redis-backed store so rate limits are shared across all PM2 cluster workers
// (an in-memory store would count each worker separately). One store per limiter
// with a distinct prefix keeps their counters isolated.
const createStore = (prefix: string): RedisStore =>
  new RedisStore({
    prefix,
    sendCommand: (...args: string[]): Promise<RedisReply> =>
      (redis.call as (...callArgs: string[]) => Promise<RedisReply>)(...args),
  });

export const apiRateLimiter = failOpen(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 100 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isProbe(req.path),
    store: createStore('rl:api:'),
    message: {
      success: false,
      message: MESSAGES.TOO_MANY_REQUESTS,
    },
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  }),
  'api',
);

// Uploads buffer bytes and hit a third-party CDN, so they are pricier than a
// plain read — throttle them tighter, and key by USER (not IP) since the route
// sits behind auth and an office NAT would otherwise share one bucket.
export const uploadRateLimiter = failOpen(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 30 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId ?? req.ip ?? 'unknown',
    store: createStore('rl:upload:'),
    message: {
      success: false,
      message: MESSAGES.TOO_MANY_REQUESTS,
    },
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  }),
  'upload',
);

export const authRateLimiter = failOpen(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 10 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('rl:auth:'),
    message: {
      success: false,
      message: MESSAGES.TOO_MANY_REQUESTS,
    },
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  }),
  'auth',
);
