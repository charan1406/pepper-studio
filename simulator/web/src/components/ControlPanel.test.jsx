import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ControlPanel from './ControlPanel';
import * as bridge from '../lib/bridge';

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    moveVelocity: vi.fn().mockResolvedValue({ success: true }),
    stopMove: vi.fn().mockResolvedValue({ success: true }),
    setPosture: vi.fn().mockResolvedValue({ success: true }),
    speak: vi.fn().mockResolvedValue({ success: true }),
    setEyeColor: vi.fn().mockResolvedValue({ success: true }),
    listAnimations: vi.fn().mockResolvedValue({ success: true, data: { animations: ['animations/Stand/Gestures/Hey_1'] } }),
    runAnimation: vi.fn().mockResolvedValue({ success: true }),
    setHead: vi.fn().mockResolvedValue({ success: true }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ControlPanel wiring', () => {
  it('clicking a posture button calls setPosture', async () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Stand' }));
    expect(bridge.setPosture).toHaveBeenCalledWith('Stand', expect.any(Number));
  });

  it('typing text and clicking Speak calls speak with the text', async () => {
    render(<ControlPanel />);
    await userEvent.type(screen.getByPlaceholderText(/say something/i), 'hello there');
    fireEvent.click(screen.getByRole('button', { name: /^speak$/i }));
    expect(bridge.speak).toHaveBeenCalledWith('hello there');
  });

  it('loads animations on mount and runs the selected one', async () => {
    render(<ControlPanel />);
    await waitFor(() => expect(bridge.listAnimations).toHaveBeenCalled());
    await screen.findByRole('option', { name: /Hey_1/ });
    fireEvent.click(screen.getByRole('button', { name: /run/i }));
    expect(bridge.runAnimation).toHaveBeenCalledWith('animations/Stand/Gestures/Hey_1');
  });

  it('pressing a move button sends velocity, releasing stops', () => {
    render(<ControlPanel />);
    const fwd = screen.getByRole('button', { name: 'Forward' });
    fireEvent.mouseDown(fwd);
    expect(bridge.moveVelocity).toHaveBeenCalledWith(1, 0, 0);
    fireEvent.mouseUp(fwd);
    expect(bridge.stopMove).toHaveBeenCalled();
  });

  it('saving a bridge URL persists it via setBridgeUrl', async () => {
    const spy = vi.spyOn(bridge, 'setBridgeUrl');
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: /bridge url/i }));
    const field = screen.getByPlaceholderText(/localhost:5001|bridge url/i);
    await userEvent.clear(field);
    await userEvent.type(field, 'http://robot.local:5001');
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(spy).toHaveBeenCalledWith('http://robot.local:5001');
  });
});
