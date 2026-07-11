'use client';

import { Ban, CircleCheck, ImageIcon, PartyPopper } from 'lucide-react';
import { Disclosure } from '@/components/upload/Disclosure';
import { ProgressSweep } from '@/components/upload/ProgressSweep';
import { MAX_PHOTOS, MIN_PHOTOS, PHOTO_REQUIREMENTS, PHOTO_RESTRICTIONS } from '@/constants/upload';
import type { QueuedPhoto } from '@/hooks/useUploadQueue';

interface UploadedPanelProps {
  photos: QueuedPhoto[];
  uploaded: number;
}

export const UploadedPanel = ({ photos, uploaded }: UploadedPanelProps) => {
  const stored = photos.filter((photo) => photo.status === 'done');
  const shortBy = Math.max(0, MIN_PHOTOS - uploaded);

  return (
    <div className="flex h-full flex-col gap-8">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-sand-900">
            Uploaded photos
          </h2>
          <p className="font-display text-lg tabular-nums text-sand-400">
            <span className="font-bold text-sand-900">{uploaded}</span> of {MAX_PHOTOS}
          </p>
        </div>
        <ProgressSweep
          value={uploaded / MAX_PHOTOS}
          weight="hair"
          label="Photos uploaded"
          className="mt-3"
        />
      </div>

      <div className="space-y-4">
        <Disclosure
          title="Photo requirements"
          tone="success"
          items={PHOTO_REQUIREMENTS}
          icon={<CircleCheck aria-hidden className="h-6 w-6 shrink-0 text-success-500" />}
        />
        <Disclosure
          title="Photo restrictions"
          tone="danger"
          items={PHOTO_RESTRICTIONS}
          icon={<Ban aria-hidden className="h-6 w-6 shrink-0 text-danger-500" />}
        />
      </div>

      {stored.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-sand-200 px-6 py-16 text-center">
          <ImageIcon aria-hidden className="h-8 w-8 text-sand-300" />
          <p className="mt-4 font-display text-base font-semibold text-sand-800">
            Your photos will appear here
          </p>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-sand-500">
            Pick at least {MIN_PHOTOS} to get started. Read the requirements above first — it saves
            a round of re-shooting.
          </p>
        </div>
      ) : (
        <div className="flex-1">
          {uploaded >= MIN_PHOTOS ? (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-success-200 bg-success-50 px-5 py-4">
              <PartyPopper aria-hidden className="h-5 w-5 shrink-0 text-success-700" />
              <p className="text-[0.9375rem] text-sand-800">
                <span className="font-display font-semibold text-sand-900">Your set is ready.</span>{' '}
                {uploaded} photos are stored and meet the requirements. Add up to{' '}
                {MAX_PHOTOS - uploaded} more for a better result.
              </p>
            </div>
          ) : (
            <p className="mb-5 text-[0.9375rem] text-sand-600">
              {shortBy} more {shortBy === 1 ? 'photo' : 'photos'} to reach the {MIN_PHOTOS}-photo
              minimum.
            </p>
          )}

          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {stored.map((photo) => (
              <li
                key={photo.id}
                className="group relative aspect-square animate-fade-up overflow-hidden rounded-2xl bg-sand-100 ring-1 ring-sand-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.result?.thumbnailUrl ?? photo.previewUrl}
                  alt={photo.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
