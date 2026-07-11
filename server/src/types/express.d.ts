import { AuthenticatedUser } from './api';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      id?: string;
    }
  }
}

export {};
