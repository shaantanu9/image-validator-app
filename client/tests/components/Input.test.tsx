import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a label when provided', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('associates label with input via htmlFor', () => {
    render(<Input label="Username" />);
    const input = screen.getByLabelText('Username');
    expect(input).toHaveAttribute('id', 'username');
  });

  it('displays error message, marks the field invalid, and applies error styling', () => {
    render(<Input label="Email" error="Invalid email" />);
    const input = screen.getByLabelText('Email');

    expect(screen.getByText('Invalid email')).toBeInTheDocument();
    // aria-invalid is what assistive tech reads; the border is what everyone else sees.
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('border-danger-500');
  });

  it('leaves a valid field unmarked', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('forwards the provided id', () => {
    render(<Input id="custom-id" label="Name" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('id', 'custom-id');
  });
});
