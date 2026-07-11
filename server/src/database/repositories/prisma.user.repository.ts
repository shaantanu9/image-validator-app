import { PrismaClient, User as PrismaUser } from '@prisma/client';
import { UserRepository, CreateUserInput, UpdateUserData } from './user.repository';
import { User } from '../../types/user';

const toDomainUser = (user: PrismaUser): User => ({
  id: user.id,
  email: user.email,
  password: user.password,
  name: user.name,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? toDomainUser(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toDomainUser(user) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const user = await this.prisma.user.create({
      data: input,
    });
    return toDomainUser(user);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
    });
    return toDomainUser(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
