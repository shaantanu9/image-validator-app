import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { handleApiError } from '@/lib/api';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
    isAxiosError: vi.fn((error) => Boolean(error && error.response)),
  },
  isAxiosError: vi.fn((error) => Boolean(error && error.response)),
}));

describe('handleApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns server message for axios errors', () => {
    const error = {
      response: {
        data: {
          success: false,
          message: 'Server error message',
        },
      },
    };

    expect(handleApiError(error)).toBe('Server error message');
  });

  it('returns fallback for axios errors without message', () => {
    const error = {
      response: {
        data: {},
      },
    };

    expect(handleApiError(error)).toBe('An unexpected error occurred');
  });

  it('returns error message for regular errors', () => {
    const error = new Error('Regular error');
    expect(handleApiError(error)).toBe('Regular error');
  });

  it('returns fallback for non-error values', () => {
    expect(handleApiError('string')).toBe('An unexpected error occurred');
    expect(handleApiError(null)).toBe('An unexpected error occurred');
  });
});
