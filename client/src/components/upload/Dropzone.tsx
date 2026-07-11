'use client';

import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCEPTED_LABEL, FILE_INPUT_ACCEPT, MAX_PHOTOS } from '@/constants/upload';

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  /** The set is full — the zone stops accepting and says why. */
  isFull: boolean;
  /** At least one photo is still in flight. */
  isUploading: boolean;
  remainingSlots: number;
}

export const Dropzone = ({ onFiles, isFull, isUploading, remainingSlots }: DropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  // dragenter/dragleave fire for every child element the cursor crosses. Counting
  // them means the highlight only drops when the cursor truly leaves the zone,
  // instead of flickering as it passes over the text inside.
  const dragDepth = useRef(0);

  const open = useCallback(() => {
    if (!isFull) inputRef.current?.click();
  }, [isFull]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (isFull) return;
    onFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        if (!isFull) setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setIsDragging(false);
      }}
      onDrop={handleDrop}
      className={cn(
        'relative rounded-3xl border-2 border-dashed px-6 py-9 text-center transition-all duration-200',
        isFull
          ? 'border-sand-200 bg-sand-50'
          : isDragging
            ? 'scale-[1.01] border-primary-400 bg-primary-50'
            : 'border-sand-300 bg-white hover:border-primary-300 hover:bg-primary-50/40',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_INPUT_ACCEPT}
        className="sr-only"
        data-testid="photo-input"
        disabled={isFull}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          // Reset, so picking the same file again still fires a change event —
          // otherwise a user who removes a photo can't re-add it.
          event.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={open}
        disabled={isFull}
        className={cn(
          'inline-flex h-11 select-none items-center justify-center gap-2 rounded-xl px-5',
          'font-display font-semibold text-white transition-all duration-150',
          'disabled:pointer-events-none disabled:opacity-50',
          isUploading ? 'bg-primary-300' : 'brand-sweep shadow-glow active:scale-[0.98]',
        )}
      >
        {isUploading ? (
          <>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Plus aria-hidden className="h-4 w-4" />
            Select photos
          </>
        )}
      </button>

      {isFull ? (
        <p className="mt-4 text-[0.9375rem] font-medium text-sand-700">
          That’s all {MAX_PHOTOS} photos. Remove one to swap it out.
        </p>
      ) : (
        <>
          <p className="mt-4 font-display text-[0.9375rem] font-semibold text-sand-800">
            Click to upload or drag and drop
          </p>
          <p className="mt-1 text-sm text-sand-500">
            {ACCEPTED_LABEL} · {remainingSlots} {remainingSlots === 1 ? 'slot' : 'slots'} left
          </p>
        </>
      )}
    </div>
  );
};
