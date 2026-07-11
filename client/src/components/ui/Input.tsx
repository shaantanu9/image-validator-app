import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

// Shared by <Input> and <PasswordInput> so a field can never look like one thing
// in the login form and another in the profile form.
export const fieldStyles = (error?: string) =>
  cn(
    'block h-12 w-full rounded-xl border bg-white px-4 text-sand-900 transition-colors',
    'placeholder:text-sand-400',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    'disabled:cursor-not-allowed disabled:bg-sand-50 disabled:opacity-60',
    error
      ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-200'
      : 'border-sand-300 focus:border-primary-400 focus:ring-primary-100',
  );

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
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
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(fieldStyles(error), className)}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-danger-700">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
