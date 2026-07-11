import { handlers } from '@/auth';

// NextAuth's route handlers (/api/auth/*): signin, callback, session, csrf, signout.
export const { GET, POST } = handlers;
