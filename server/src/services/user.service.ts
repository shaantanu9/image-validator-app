import { userRepository } from '../database/repositories';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { UpdateUserInput } from '../validations/user.schema';
import { PublicUser } from '../types/user';

const toPublicUser = (user: {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const findUserById = async (id: string): Promise<PublicUser> => {
  const user = await userRepository.findById(id);

  if (!user) {
    throw ApiError.notFound(MESSAGES.USER_NOT_FOUND);
  }

  return toPublicUser(user);
};

export const updateUser = async (id: string, input: UpdateUserInput): Promise<PublicUser> => {
  await findUserById(id);

  const user = await userRepository.update(id, input);

  return toPublicUser(user);
};

export const deleteUser = async (id: string): Promise<void> => {
  await findUserById(id);
  await userRepository.delete(id);
};
