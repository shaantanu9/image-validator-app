import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h2 className="text-6xl font-bold text-primary-600">404</h2>
      <p className="mt-4 text-xl text-gray-900">Page not found</p>
      <p className="mt-2 text-gray-600">The page you are looking for does not exist.</p>
      <Link href={ROUTES.HOME}>
        <Button className="mt-6">Go Home</Button>
      </Link>
    </div>
  );
}
