'use client';

import { SessionProvider } from 'next-auth/react';

// Wraps the app so client components can use `useSession()`. Kept as a thin
// 'use client' boundary so the root layout can stay a Server Component.
export function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
