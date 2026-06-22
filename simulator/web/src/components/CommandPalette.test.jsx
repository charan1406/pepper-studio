import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommandPalette from './CommandPalette';
import * as bridge from '../lib/bridge';
import { usePepperStore } from '../hooks/usePepperState';

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, setPosture: vi.fn(), stopMove: vi.fn(), setHead: vi.fn(), stopSpeak: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
  usePepperStore.setState({ paletteOpen: false, mode: 'sim' });
});

describe('CommandPalette', () => {
  it('⌘K opens the palette', () => {
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText(/type a command/i)).toBeNull();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(usePepperStore.getState().paletteOpen).toBe(true);
  });

  it('filters and runs a command on Enter', () => {
    usePepperStore.setState({ paletteOpen: true });
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: 'stop movement' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(bridge.stopMove).toHaveBeenCalled();
    expect(usePepperStore.getState().paletteOpen).toBe(false);
  });

  it('clicking a command runs it', () => {
    usePepperStore.setState({ paletteOpen: true });
    render(<CommandPalette />);
    fireEvent.click(screen.getByRole('button', { name: /switch to real robot/i }));
    expect(usePepperStore.getState().mode).toBe('real');
  });

  it('shows an empty state for no matches', () => {
    usePepperStore.setState({ paletteOpen: true });
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText(/type a command/i), { target: { value: 'zzzzz' } });
    expect(screen.getByText(/no matching commands/i)).toBeInTheDocument();
  });
});
