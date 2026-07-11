import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import FaultToast from './FaultToast';
import { reportFault } from '../lib/bridge';

afterEach(() => vi.useRealTimers());

const fire = (message) => act(() => { reportFault(message); });

describe('FaultToast', () => {
  it('renders nothing until a fault is reported', () => {
    render(<FaultToast />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the fault message and auto-dismisses', () => {
    vi.useFakeTimers();
    render(<FaultToast />);
    fire('/move/velocity — bridge unreachable at http://x');
    expect(screen.getByRole('alert').textContent).toContain('bridge unreachable');
    act(() => vi.advanceTimersByTime(5100));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('replaces the message on a newer fault and dismisses on click', () => {
    vi.useFakeTimers();
    render(<FaultToast />);
    fire('first fault');
    fire('second fault');
    expect(screen.getByRole('alert').textContent).toContain('second fault');
    expect(screen.queryByText(/first fault/)).toBeNull();
    fireEvent.click(screen.getByRole('alert'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('bridge fault reporting', () => {
  it('post() reports a fault with the server error on non-ok responses', async () => {
    const events = [];
    const onFault = (e) => events.push(e.detail.message);
    window.addEventListener('bridge-fault', onFault);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: false, error: 'unknown parameter(s) vx for /move/velocity — expected: theta, x, y' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )));
    const { moveVelocity } = await import('../lib/bridge');
    await expect(moveVelocity(1, 0, 0)).rejects.toThrow(/unknown parameter/);
    expect(events.some((m) => m.includes('expected: theta, x, y'))).toBe(true);
    window.removeEventListener('bridge-fault', onFault);
    vi.unstubAllGlobals();
  });
});
