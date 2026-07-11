import { prisma } from '../prisma/client';
import { PrismaUserRepository } from './prisma.user.repository';
import { PrismaImageRepository } from './prisma.image.repository';

export const userRepository = new PrismaUserRepository(prisma);
export const imageRepository = new PrismaImageRepository(prisma);

export * from './user.repository';
export * from './image.repository';
