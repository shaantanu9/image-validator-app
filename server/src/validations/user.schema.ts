import { z } from 'zod';

// The only self-service field a plain user may change. `isActive` is deliberately
// absent: deactivating an account is what `DELETE /auth/me` is for, and exposing
// it here would let a client flip the flag back on for itself.
export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
