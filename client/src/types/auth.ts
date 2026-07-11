export interface User {
  id: string;
  userId: string;
  email: string;
  name: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  tokens: AuthTokens;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name?: string;
}
