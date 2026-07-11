import { prisma } from './prisma/client';
import logger from '../utils/logger';

export { userRepository } from './repositories';

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  logger.info('PostgreSQL connected successfully');
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
};

// Readiness probe: verifies the database is actually reachable, not just that
// the process is up. Kept DB-agnostic at the call site (see /ready in app.ts).
export const checkDatabaseHealth = async (): Promise<boolean> => {
  await prisma.$queryRaw`SELECT 1`;
  return true;
};
