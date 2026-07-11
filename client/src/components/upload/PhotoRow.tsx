'use client';

import { Check, Loader2, RotateCw, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/uploadValidation';
import type { QueuedPhoto } from '@/hooks/useUploadQueue';

interface PhotoRowProps {
  photo: QueuedPhoto;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

/**
 * One photo in the queue. The thumbnail is the local file, so it appears the
 * instant the photo is picked — the user sees what they chose before the network
 * has done anything.
 */
export const PhotoRow = ({ photo, onRemove, onRetry }: PhotoRowProps) => {
  const failed = photo.status === 'error';
  const done = photo.status === 'done';
  const busy = photo.status === 'uploading' || photo.status === 'queued';

  return (
    <li
      className={cn(
        'group flex animate-fade-up items-center gap-3 rounded-2xl border bg-white p-2.5 pr-3 transition-colors',
        failed ? 'border-danger-200 bg-danger-50' : 'border-sand-200 hover:border-sand-300',
      )}
    >
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-sand-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.previewUrl}
          alt=""
          className={cn(
            'h-full w-full object-cover transition-opacity',
            busy && 'opacity-50',
            failed && 'opacity-40 grayscale',
          )}
        />
        {done && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-success-500 ring-2 ring-white">
            <Check aria-hidden className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sand-900" title={photo.name}>
          {photo.name}
        </p>
        {failed ? (
          <p className="truncate text-xs text-danger-700">{photo.error}</p>
        ) : busy ? (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-sand-200">
            <div
              className="brand-sweep h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${photo.status === 'queued' ? 4 : photo.progress}%` }}
            />
          </div>
        ) : (
          <p className="text-xs text-sand-500">{formatBytes(photo.size)}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin text-primary-500" />}
        {failed && (
          <>
            <TriangleAlert aria-hidden className="h-4 w-4 text-danger-500" />
            <button
              type="button"
              onClick={() => onRetry(photo.id)}
              aria-label={`Retry ${photo.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-sand-500 transition-colors hover:bg-white hover:text-sand-900"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onRemove(photo.id)}
          aria-label={`Remove ${photo.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-sand-400 transition-colors hover:bg-sand-100 hover:text-sand-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
};
