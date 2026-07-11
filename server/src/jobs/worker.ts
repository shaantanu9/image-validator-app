// Standalone process: nothing else loads .env for us (src/app.ts does it for the
// API). Without this, envalid dies at import time with "Missing environment
// variables" and `pnpm worker` exits 1 before consuming a single job.
import 'dotenv/config';
import IORedis from 'ioredis';
import { Worker } from 'bullmq';
import { appConfig } from '../config/app.config';
import logger from '../utils/logger';
import { EMAIL_QUEUE, processWelcomeEmail } from './emailQueue';

// Standalone worker process — run with `pnpm --filter <server> worker`.
// Consumes jobs the API enqueues (e.g. welcome emails on registration) so the
// work happens off the request/response path.
const connection = new IORedis(appConfig.redis.url, { maxRetriesPerRequest: null });

// `autorun: false`: a Worker starts its BZPOPMIN fetch loop the instant it is
// constructed. With the default (`true`) it pulls the first job before any
// dependency the processor needs is connected — which bites on every deploy and
// crash-recovery, when jobs are already queued at boot.
const worker = new Worker(EMAIL_QUEUE, processWelcomeEmail, {
  connection,
  concurrency: 5,
  prefix: appConfig.redis.bullmqPrefix,
  autorun: false,
});

worker.on('completed', (job) => logger.info('Job completed', { id: job.id, name: job.name }));
worker.on('failed', (job, err) => logger.error('Job failed', { id: job?.id, error: err.message }));

// Worker and the raw connection are EventEmitters: Node THROWS on an 'error' event
// with no listener, so one Redis blip would kill this process outright.
worker.on('error', (err: Error) => logger.error('Worker error', { error: err.message }));
connection.on('error', (err: Error) => logger.error('Worker Redis error', { error: err.message }));

// Start pulling only after setup. `void worker.run()` would swallow a startup
// rejection and leave a zombie process holding no jobs.
const start = async (): Promise<void> => {
  await worker.run();
};

start().catch((err: unknown) => {
  logger.error('Worker startup failed', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

logger.info('Email worker started', {
  queue: EMAIL_QUEUE,
  prefix: appConfig.redis.bullmqPrefix,
});

let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Worker shutting down', { signal });

  // `worker.close()` waits for in-flight jobs and has NO internal timeout. A wedged
  // job hangs here until the orchestrator SIGKILLs us mid-job — the lock is never
  // released and the job re-runs as stalled. Force-exit below that grace period.
  const forceExit = setTimeout(() => {
    logger.error('Worker shutdown timed out; forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    await worker.close();
    await connection.quit();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error('Worker shutdown failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Per-emitter listeners are necessary but not sufficient: ioredis can emit before
// BullMQ attaches its own. Exit non-zero so an orchestrator surfaces the crash loop.
process.on('uncaughtException', (err: Error) => {
  logger.error('Worker uncaught exception', { error: err.message });
  process.exit(1);
});
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Worker unhandled rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
  process.exit(1);
});
