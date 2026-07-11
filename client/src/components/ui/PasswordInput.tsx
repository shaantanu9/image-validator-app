'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldStyles } from '@/components/ui/Input';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

// A password field with a show/hide eye toggle. Borrows <Input>'s field styles so
// the two can't drift, and adds right-padding for the toggle. The button is
// type="button" so it never submits the form, and tabIndex={-1} keeps it out of
// the tab order.
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block font-display text-sm font-semibold text-sand-800"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            aria-invalid={error ? true : undefined}
            className={cn(fieldStyles(error), 'pr-11', className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-sand-400 transition-colors hover:text-sand-700"
          >
            {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {error && <p className="mt-1.5 text-sm text-danger-700">{error}</p>}
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
