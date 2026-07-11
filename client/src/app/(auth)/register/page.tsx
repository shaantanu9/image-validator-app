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
import { formatErrorBody } from '@/lib/api';
import { ApiErrorResponse } from '@/types/api';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5012/api/v1';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Name is optional; omit it when blank so the server's `.min(2)` rule on the
    // optional field isn't triggered by an empty string.
    const trimmedName = formData.name.trim();
    const payload = trimmedName
      ? { name: trimmedName, email: formData.email, password: formData.password }
      : { email: formData.email, password: formData.password };

    try {
      // Create the account on the Express backend...
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as Partial<ApiErrorResponse>;
      if (!res.ok) {
        // Surface the server's per-field validation reasons (e.g. "Password must
        // contain at least one number"), not just the generic "Validation error."
        setError(formatErrorBody(body, 'Registration failed'));
        setIsLoading(false);
        return;
      }

      // ...then establish the NextAuth session by signing in with the same creds.
      const signInRes = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });
      setIsLoading(false);
      if (signInRes?.error) {
        setError('Account created, but sign-in failed — try logging in.');
        return;
      }
      router.push(ROUTES.DASHBOARD);
      router.refresh();
    } catch {
      setError('Registration failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4.25rem)] items-center justify-center bg-sand-50 px-5 py-16">
      <Card className="w-full max-w-md shadow-lift">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <p className="mt-2 text-[0.9375rem] text-sand-600">Then upload your first photo set.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="John Doe"
            />
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
              {isLoading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-sand-600">
            Already have an account?{' '}
            <Link
              href={ROUTES.LOGIN}
              className="font-semibold text-primary-600 underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
