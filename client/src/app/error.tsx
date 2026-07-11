'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h2 className="text-3xl font-bold text-gray-900">Something went wrong</h2>
      <p className="mt-2 text-gray-600">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <Button onClick={reset} className="mt-6">
        Try Again
      </Button>
    </div>
  );
}
