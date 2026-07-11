import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders an svg spinner', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies default size classes to the svg', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('svg')).toHaveClass('h-8 w-8');
  });

  it('applies small size classes to the svg', () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    expect(container.querySelector('svg')).toHaveClass('h-4 w-4');
  });

  it('applies custom className to the wrapper', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
