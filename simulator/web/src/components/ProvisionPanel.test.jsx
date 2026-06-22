import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProvisionPanel from './ProvisionPanel';
import * as bridge from '../lib/bridge';

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProvisionStatus: vi.fn().mockResolvedValue({
      success: true, data: { state: 'idle', step: '', progress: 0, log: [], provisioned: false, bundle: 'full' },
    }),
    startProvision: vi.fn().mockResolvedValue({ success: true, data: { state: 'running', step: 'resolve', log: [] } }),
  };
});

beforeEach(() => vi.clearAllMocks());

describe('ProvisionPanel', () => {
  it('Download & start triggers provisioning with auto-detect by default', async () => {
    render(<ProvisionPanel />);
    fireEvent.click(screen.getByRole('button', { name: /download & start/i }));
    await waitFor(() => expect(bridge.startProvision).toHaveBeenCalled());
    expect(bridge.startProvision.mock.calls[0][0]).toBe(''); // '' => auto-detect
  });

  it('passes the chosen backend override', async () => {
    render(<ProvisionPanel />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'vulkan' } });
    fireEvent.click(screen.getByRole('button', { name: /download & start/i }));
    await waitFor(() => expect(bridge.startProvision).toHaveBeenCalledWith('vulkan'));
  });

  it('shows ready state when already provisioned', async () => {
    bridge.getProvisionStatus.mockResolvedValueOnce({
      success: true, data: { state: 'done', step: 'done', progress: 1, log: [], provisioned: true, bundle: 'full' },
    });
    render(<ProvisionPanel />);
    await screen.findByText(/brain ready/i);
  });
});
