import IORedis from 'ioredis';
import { Queue, type Job } from 'bullmq';
import { appConfig } from '../config/app.config';
import logger from '../utils/logger';

export const EMAIL_QUEUE = 'emails';
const WELCOME_EMAIL = 'welcome-email';

export interface WelcomeEmailData {
  userId: string;
  email: string;
}

// BullMQ requires a dedicated connection with `maxRetriesPerRequest: null`.
// Created lazily so importing this module (e.g. from the auth service) does not
// open a Redis connection until a job is actually enqueued.
let connection: IORedis | null = null;
let queue: Queue | null = null;

const getConnection = (): IORedis => {
  if (!connection) {
    connection = new IORedis(appConfig.redis.url, { maxRetriesPerRequest: null });
    // `IORedis` is an EventEmitter: an 'error' event with no listener makes Node
    // THROW. Without this, one transient Redis blip kills the API process.
    connection.on('error', (err: Error) => {
      logger.error('Queue Redis connection error', { error: err.message });
    });
  }
  return connection;
};

export const getEmailQueue = (): Queue => {
  if (!queue) {
    // `prefix` namespaces every key. Dev, test and prod on one Redis otherwise share
    // one keyspace, and a stray dev worker eats the job your test just enqueued.
    queue = new Queue(EMAIL_QUEUE, {
      connection: getConnection(),
      prefix: appConfig.redis.bullmqPrefix,
    });
    queue.on('error', (err: Error) => {
      logger.error('Email queue error', { error: err.message });
    });
  }
  return queue;
};

// Fire-and-forget producer. Enqueue failures must never break the request that
// triggered them (registration still succeeds), so we swallow-and-log — the job
// is best-effort and the API stays responsive even if Redis is unavailable.
export const enqueueWelcomeEmail = async (data: WelcomeEmailData): Promise<void> => {
  try {
    await getEmailQueue().add(WELCOME_EMAIL, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  } catch (err) {
    logger.error('Failed to enqueue welcome email', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// The worker's job processor — pure and unit-testable. A real app would call an
// email provider here; we log so the async flow is observable end-to-end.
export const processWelcomeEmail = async (job: Job<WelcomeEmailData>): Promise<void> => {
  logger.info('Processing welcome email', {
    userId: job.data.userId,
    email: job.data.email,
  });
};

// Releases the queue + connection so tests (and graceful shutdown) don't leak
// open Redis handles.
export const closeEmailQueue = async (): Promise<void> => {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
};
