import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsDrawer from './SettingsDrawer';
import * as bridge from '../lib/bridge';
import { usePepperStore } from '../hooks/usePepperState';

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    setBridgeUrl: vi.fn(),
    // Silence the child panels' polling.
    getRobotStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'disconnected', log: '', battery: null, error: '', bridge_url: '' } }),
    getServicesStatus: vi.fn().mockResolvedValue({ success: true, data: { searxng: { running: false, present: true, error: '' } } }),
    getRunnerStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'stopped' } }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  usePepperStore.setState({ settingsOpen: true, aiPanelOpen: false, aiInitialSource: null });
});

describe('SettingsDrawer', () => {
  it('saving a bridge URL persists it via setBridgeUrl', async () => {
    render(<SettingsDrawer />);
    const field = screen.getByPlaceholderText(/localhost:5001/i);
    await userEvent.clear(field);
    await userEvent.type(field, 'http://robot.local:5001');
    fireEvent.click(screen.getByRole('button', { name: /save bridge url/i }));
    expect(bridge.setBridgeUrl).toHaveBeenCalledWith('http://robot.local:5001');
  });

  it('close button collapses the drawer', () => {
    render(<SettingsDrawer />);
    fireEvent.click(screen.getByRole('button', { name: /close setup/i }));
    expect(usePepperStore.getState().settingsOpen).toBe(false);
  });
});
