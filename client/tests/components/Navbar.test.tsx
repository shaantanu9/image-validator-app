import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '@/components/common/Navbar';
import * as useAuthModule from '@/hooks/useAuth';
import { APP_CONFIG } from '@/constants/config';

const mockLogout = vi.fn();

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders branding and login/register links when not authenticated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: true,
      logout: mockLogout,
      clearError: vi.fn(),
    });

    render(<Navbar />);

    expect(screen.getByText(APP_CONFIG.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('renders user email and logout button when authenticated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1', userId: '1', email: 'user@example.com', name: 'User' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasHydrated: true,
      logout: mockLogout,
      clearError: vi.fn(),
    });

    render(<Navbar />);

    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('hides auth-dependent links until the store has hydrated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1', userId: '1', email: 'user@example.com', name: 'User' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasHydrated: false,
      logout: mockLogout,
      clearError: vi.fn(),
    });

    render(<Navbar />);

    // Branding always shows; auth state does not until hydration completes.
    expect(screen.getByText(APP_CONFIG.name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('calls logout when logout button is clicked', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1', userId: '1', email: 'user@example.com', name: 'User' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasHydrated: true,
      logout: mockLogout,
      clearError: vi.fn(),
    });

    render(<Navbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
