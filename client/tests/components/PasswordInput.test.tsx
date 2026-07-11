import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PasswordInput } from '@/components/ui/PasswordInput';

describe('PasswordInput', () => {
  it('renders a password field by default', () => {
    const { container } = render(<PasswordInput label="Password" />);
    expect(container.querySelector('input')).toHaveAttribute('type', 'password');
  });

  it('toggles visibility when the eye button is clicked', () => {
    const { container } = render(<PasswordInput label="Password" />);
    const input = container.querySelector('input')!;
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows an error message when provided', () => {
    render(<PasswordInput label="Password" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
