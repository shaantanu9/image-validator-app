import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dropzone } from '@/components/upload/Dropzone';

const props = {
  onFiles: vi.fn(),
  isFull: false,
  isUploading: false,
  remainingSlots: 10,
};

describe('Dropzone', () => {
  it('hands picked files to the caller', () => {
    const onFiles = vi.fn();
    render(<Dropzone {...props} onFiles={onFiles} />);

    const file = new File([new Uint8Array(8)], 'selfie.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('photo-input'), { target: { files: [file] } });

    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('clears the input value so the same file can be picked again after removal', () => {
    render(<Dropzone {...props} />);
    const input = screen.getByTestId('photo-input') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(8)], 'a.jpg', { type: 'image/jpeg' })] },
    });

    expect(input.value).toBe('');
  });

  it('shows the uploading state while photos are in flight', () => {
    render(<Dropzone {...props} isUploading />);

    expect(screen.getByRole('button', { name: /uploading/i })).toBeInTheDocument();
  });

  it('stops accepting files once the set is full', () => {
    const onFiles = vi.fn();
    render(<Dropzone {...props} onFiles={onFiles} isFull remainingSlots={0} />);

    expect(screen.getByTestId('photo-input')).toBeDisabled();
    expect(screen.getByText(/remove one to swap it out/i)).toBeInTheDocument();

    // A drop on a full zone is ignored rather than silently queued and rejected.
    fireEvent.drop(screen.getByRole('button').parentElement as HTMLElement, {
      dataTransfer: { files: [new File([new Uint8Array(8)], 'x.jpg', { type: 'image/jpeg' })] },
    });

    expect(onFiles).not.toHaveBeenCalled();
  });

  it('announces how many slots are left', () => {
    render(<Dropzone {...props} remainingSlots={1} />);

    expect(screen.getByText(/1 slot left/i)).toBeInTheDocument();
  });
});
