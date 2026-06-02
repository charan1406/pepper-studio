import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ApiReference from './ApiReference';

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue() },
    configurable: true,
  });
});

describe('ApiReference', () => {
  it('renders both sections and known endpoints', () => {
    render(<ApiReference onClose={() => {}} />);
    expect(screen.getByText('Robot API')).toBeInTheDocument();
    expect(screen.getByText('Studio API')).toBeInTheDocument();
    expect(screen.getAllByText(/\/move\/velocity/).length).toBeGreaterThan(0);
  });

  it('copy curl puts a curl string on the clipboard', () => {
    render(<ApiReference onClose={() => {}} />);
    const btn = screen.getAllByRole('button', { name: /copy curl/i })[0];
    fireEvent.click(btn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('curl'));
  });

  it('close button fires onClose', () => {
    const onClose = vi.fn();
    render(<ApiReference onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close|✕/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
