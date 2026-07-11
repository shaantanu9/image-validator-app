import { cn } from '@/lib/utils';

interface ProgressSweepProps {
  /** 0–1. */
  value: number;
  className?: string;
  /** Height of the track. `hair` is the rule under a heading; `bar` is the top bar. */
  weight?: 'hair' | 'bar';
  label?: string;
}

/**
 * The app's progress material. Every place progress is shown — the top bar, the
 * rule under "Uploaded photos" — is this same coral→amber sweep on a sand track,
 * so a photo landing reads as one thing advancing, not four unrelated widgets.
 */
export const ProgressSweep = ({
  value,
  className,
  weight = 'bar',
  label = 'Upload progress',
}: ProgressSweepProps) => {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'w-full overflow-hidden rounded-full bg-sand-200',
        weight === 'bar' ? 'h-1.5' : 'h-px bg-sand-200',
        className,
      )}
    >
      <div
        className="brand-sweep h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};
