'use client';

import { useEffect, useState, useRef, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { uploadImage } from '@/lib/imagekit';
import api, { handleApiError } from '@/lib/api';
import { ApiSuccessResponse } from '@/types/api';

interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Account page with an ImageKit avatar-upload demo and an inline name editor
// backed by PATCH /auth/me. The uploaded avatar is shown for the session only —
// persisting it would need a dedicated avatar-URL field, noted as a "with more
// time" item.
export default function ProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const result = await uploadImage(file);
      setAvatarUrl(result.url);
    } catch (err) {
      setError(handleApiError(err) || (err instanceof Error ? err.message : 'Upload failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleNameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    setNameError(null);
    setNameSaved(false);
    try {
      const { data } = await api.patch<ApiSuccessResponse<MeResponse>>('/auth/me', { name });
      setName(data.data.name ?? '');
      setNameSaved(true);
    } catch (err) {
      setNameError(handleApiError(err));
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight text-sand-900">Profile</h1>
        <Link href={ROUTES.DASHBOARD}>
          <Button variant="outline" size="sm">
            Back to dashboard
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-sand-100 text-2xl text-sand-400">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote ImageKit URL, not a build-time asset
                <img src={avatarUrl} alt="Uploaded avatar" className="h-full w-full object-cover" />
              ) : (
                <span>
                  {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
                data-testid="avatar-input"
              />
              <Button size="sm" isLoading={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? 'Uploading…' : 'Upload image'}
              </Button>
              {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}
              {avatarUrl && (
                <p className="mt-2 break-all text-xs text-sand-500">Stored at: {avatarUrl}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Edit name</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNameSubmit} className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameSaved(false);
                }}
                data-testid="name-input"
              />
            </div>
            <Button type="submit" size="sm" isLoading={savingName}>
              {savingName ? 'Saving…' : 'Save'}
            </Button>
          </form>
          {nameError && <p className="mt-2 text-sm text-danger-700">{nameError}</p>}
          {nameSaved && !nameError && (
            <p className="mt-2 text-sm text-success-700">Name updated.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-sand-500">Name</dt>
              <dd className="text-sand-900">{name || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-sand-500">Email</dt>
              <dd className="text-sand-900">{user?.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-sand-500">User ID</dt>
              <dd className="break-all font-mono text-xs text-sand-900">{user?.id ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
