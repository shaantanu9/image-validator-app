'use client';

import { useSession } from 'next-auth/react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

// The edge middleware already redirects unauthenticated visitors to /login, so
// by the time this renders the user is authenticated. We still show a spinner
// while NextAuth resolves the session on the client to avoid a content flash.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return <>{children}</>;
}
