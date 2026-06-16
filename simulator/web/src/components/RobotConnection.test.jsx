import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RobotConnection from './RobotConnection';
import * as bridge from '../lib/bridge';

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getRobotStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'disconnected', log: '', battery: null, error: '', bridge_url: '' } }),
    connectRobot: vi.fn().mockResolvedValue({ success: true, data: { state: 'connecting', log: '', battery: null, error: '', bridge_url: '' } }),
    disconnectRobot: vi.fn().mockResolvedValue({ success: true, data: { state: 'disconnected', log: '', battery: null, error: '', bridge_url: '' } }),
    setBridgeUrl: vi.fn(),
  };
});

beforeEach(() => vi.clearAllMocks());

describe('RobotConnection', () => {
  it('shows disconnected by default', async () => {
    render(<RobotConnection />);
    await waitFor(() => expect(bridge.getRobotStatus).toHaveBeenCalled());
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
  });

  it('Connect sends host + user', async () => {
    render(<RobotConnection />);
    fireEvent.change(screen.getByPlaceholderText(/robot IP/i), { target: { value: '192.168.1.17' } });
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    await waitFor(() => expect(bridge.connectRobot).toHaveBeenCalled());
    const arg = bridge.connectRobot.mock.calls[0][0];
    expect(arg.host).toBe('192.168.1.17');
    expect(arg.user).toBe('nao');
  });

  it('points the bridge URL at the robot once connected', async () => {
    bridge.getRobotStatus.mockResolvedValue({
      success: true,
      data: { state: 'connected', log: '[BRIDGE] up', battery: 91, error: '', bridge_url: 'http://192.168.1.17:5001' },
    });
    render(<RobotConnection />);
    await waitFor(() => expect(bridge.setBridgeUrl).toHaveBeenCalledWith('http://192.168.1.17:5001'));
    expect(screen.getByText(/battery 91%/i)).toBeInTheDocument();
  });

  it('Disconnect calls disconnectRobot', async () => {
    render(<RobotConnection />);
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    await waitFor(() => expect(bridge.disconnectRobot).toHaveBeenCalled());
  });
});
