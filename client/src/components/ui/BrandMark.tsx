import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  /** Hide the wordmark and show only the glyph. */
  glyphOnly?: boolean;
  label?: string;
}

/**
 * The app's logo: an aperture bracketing a face, on a coral tile. It reads as
 * "we look at your photo" — which is the whole product — and its brackets are
 * reused as the focus corners on the dropzone.
 */
export const BrandMark = ({ className, glyphOnly = false, label }: BrandMarkProps) => (
  <span className={cn('inline-flex items-center gap-2.5', className)}>
    <span className="brand-sweep flex h-9 w-9 items-center justify-center rounded-xl shadow-glow">
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-5 w-5 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Viewfinder corners */}
        <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
        {/* The face inside it */}
        <circle cx="12" cy="11" r="2.1" />
        <path d="M8.6 16.2a4 4 0 0 1 6.8 0" />
      </svg>
    </span>
    {!glyphOnly && (
      <span className="font-display text-lg font-bold tracking-tight text-sand-900">{label}</span>
    )}
  </span>
);
