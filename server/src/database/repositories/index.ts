import { prisma } from '../prisma/client';
import { PrismaUserRepository } from './prisma.user.repository';

export const userRepository = new PrismaUserRepository(prisma);

export * from './user.repository';
