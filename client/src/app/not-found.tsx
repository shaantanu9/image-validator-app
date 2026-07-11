import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
      <p className="brand-sweep-text font-display text-7xl font-bold tracking-tight">404</p>
      <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-sand-900">
        This page doesn’t exist
      </h1>
      <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-sand-600">
        The link may be out of date, or the page may have moved.
      </p>
      <Link href={ROUTES.HOME} className="mt-7">
        <Button size="lg">Back to home</Button>
      </Link>
    </div>
  );
}
