import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const variantStyles = {
  // Coral is loud, so exactly one button on a screen may be primary.
  primary: 'bg-primary-500 text-white shadow-glow hover:bg-primary-600 active:bg-primary-700',
  secondary: 'bg-sand-900 text-white hover:bg-sand-800',
  // The reference's "Back" control: white, hairline, lifts on hover.
  outline: 'border border-sand-300 bg-white text-sand-800 shadow-card hover:bg-sand-50',
  ghost: 'text-sand-700 hover:bg-sand-100',
  danger: 'bg-danger-500 text-white hover:bg-danger-700',
};

const sizeStyles = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-[0.9375rem]',
  lg: 'h-12 px-7 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex select-none items-center justify-center gap-2 rounded-xl font-display font-semibold',
          'transition-all duration-150 active:scale-[0.98]',
          'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
