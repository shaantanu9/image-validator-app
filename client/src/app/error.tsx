'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
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
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50">
        <TriangleAlert aria-hidden className="h-6 w-6 text-danger-500" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-sand-900">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-[0.9375rem] leading-relaxed text-sand-600">
        {error.message || 'The page didn’t load. Trying again usually fixes it.'}
      </p>
      <Button onClick={reset} size="lg" className="mt-7">
        Try again
      </Button>
    </div>
  );
}
