import { User, CreateUserInput, UpdateUserData } from '../../types/user';

export { User, PublicUser, CreateUserInput, UpdateUserData } from '../../types/user';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  delete(id: string): Promise<void>;
}
