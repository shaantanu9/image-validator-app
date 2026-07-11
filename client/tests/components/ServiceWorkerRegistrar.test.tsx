import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ServiceWorkerRegistrar } from '@/components/common/ServiceWorkerRegistrar';

describe('ServiceWorkerRegistrar', () => {
  it('renders nothing (no DOM output)', () => {
    const { container } = render(<ServiceWorkerRegistrar />);
    expect(container.firstChild).toBeNull();
  });

  it('does not attempt registration outside production', () => {
    // NODE_ENV is "test" here, so the effect must early-return without touching
    // navigator.serviceWorker — rendering must not throw.
    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow();
  });
});
