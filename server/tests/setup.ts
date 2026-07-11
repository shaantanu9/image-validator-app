import { beforeAll, afterAll, afterEach } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../src/database';
import { prisma } from '../src/database/prisma/client';
import { redis } from '../src/database/redis';
import { closeEmailQueue } from '../src/jobs/emailQueue';

beforeAll(async () => {
  await connectDatabase();
  await redis.ping();
});

afterEach(async () => {
  await prisma.user.deleteMany();
  await redis.flushdb();
});

afterAll(async () => {
  await closeEmailQueue();
  await disconnectDatabase();
  await redis.quit();
});
