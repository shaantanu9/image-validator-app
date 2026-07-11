export interface User {
  id: string;
  email: string;
  password: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export interface UpdateUserData {
  name?: string;
}
