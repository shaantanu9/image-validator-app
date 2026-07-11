import { PrismaClient } from '@prisma/client';
import { appConfig } from '../../config/app.config';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

export const getPrisma = (): PrismaClient => prisma;

if (appConfig.isDev) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
