'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DisclosureProps {
  title: string;
  icon: ReactNode;
  items: readonly string[];
  tone: 'success' | 'danger';
  defaultOpen?: boolean;
}

const toneStyles = {
  success: {
    shell: 'border-success-200 bg-success-50',
    marker: 'bg-success-500',
  },
  danger: {
    shell: 'border-danger-200 bg-danger-50',
    marker: 'bg-danger-500',
  },
};

/**
 * A rules panel that opens and closes. Requirements are tinted green and
 * restrictions red, so the two are separable at a glance without reading —
 * the colour is the categorisation, not decoration.
 */
export const Disclosure = ({ title, icon, items, tone, defaultOpen = false }: DisclosureProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const styles = toneStyles[tone];

  return (
    <div className={cn('rounded-3xl border transition-colors', styles.shell)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3.5 rounded-3xl px-6 py-5 text-left"
      >
        {icon}
        <span className="flex-1 font-display text-lg font-bold tracking-tight text-sand-900">
          {title}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'h-5 w-5 shrink-0 text-sand-500 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul id={panelId} className="animate-fade-up space-y-2.5 px-6 pb-6 pl-[4.1rem]">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-sand-700">
              <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', styles.marker)} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
