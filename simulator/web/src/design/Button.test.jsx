import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the variant class', () => {
    render(<Button variant="danger">Stop</Button>);
    expect(screen.getByRole('button', { name: 'Stop' }).className).toMatch(/text-danger/);
  });

  it('falls back to primary styling for an unknown variant (no "undefined" class)', () => {
    render(<Button variant="bogus">X</Button>);
    const cls = screen.getByRole('button', { name: 'X' }).className;
    expect(cls).not.toMatch(/undefined/);
    expect(cls).toMatch(/bg-accent/);
  });
});
