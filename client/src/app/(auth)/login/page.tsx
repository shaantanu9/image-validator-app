'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ROUTES } from '@/constants/routes';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Delegate to NextAuth's Credentials provider, which posts to the Express API
    // and stores the returned tokens in the session cookie.
    const res = await signIn('credentials', {
      email: formData.email,
      password: formData.password,
      redirect: false,
    });
    setIsLoading(false);

    if (res?.error) {
      setError('Invalid email or password');
      return;
    }

    // Honour ?callbackUrl= set by the auth middleware, but only allow safe
    // internal paths (never an absolute/protocol-relative URL → open redirect).
    const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl');
    const target =
      callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
        ? callbackUrl
        : ROUTES.DASHBOARD;
    router.push(target);
    router.refresh();
  };

  return (
    <div className="flex min-h-[calc(100vh-4.25rem)] items-center justify-center bg-sand-50 px-5 py-16">
      <Card className="w-full max-w-md shadow-lift">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <p className="mt-2 text-[0.9375rem] text-sand-600">
            Sign in to upload and check your photos.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              required
              placeholder="you@example.com"
            />
            <PasswordInput
              label="Password"
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              required
              placeholder="••••••••"
            />

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-danger-200 bg-danger-50 p-3.5 text-sm text-danger-700"
              >
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-sand-600">
            Don&apos;t have an account?{' '}
            <Link
              href={ROUTES.REGISTER}
              className="font-semibold text-primary-600 underline-offset-4 hover:underline"
            >
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
