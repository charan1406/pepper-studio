import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProvisionPanel from './ProvisionPanel';
import * as bridge from '../lib/bridge';

const MODELS = [
  { id: '2b', label: 'Qwen3-VL 2B', default: false },
  { id: '4b', label: 'Qwen3-VL 4B', default: true },
  { id: '8b', label: 'Qwen3-VL 8B', default: false },
];

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProvisionStatus: vi.fn(),
    startProvision: vi.fn().mockResolvedValue({ success: true, data: { state: 'running', step: 'resolve', log: [] } }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  bridge.getProvisionStatus.mockResolvedValue({
    success: true,
    data: { state: 'idle', step: '', progress: 0, log: [], provisioned: false, bundle: 'full', models: MODELS },
  });
});

describe('ProvisionPanel', () => {
  it('defaults to auto-detect backend + the server-recommended model size', async () => {
    render(<ProvisionPanel />);
    await screen.findByRole('option', { name: /4B/ });
    fireEvent.click(screen.getByRole('button', { name: /download & start/i }));
    await waitFor(() => expect(bridge.startProvision).toHaveBeenCalledWith('', '4b'));
  });

  it('passes the chosen backend and model size', async () => {
    render(<ProvisionPanel />);
    await screen.findByRole('option', { name: /8B/ });
    fireEvent.change(screen.getByRole('combobox', { name: /model size/i }), { target: { value: '8b' } });
    fireEvent.change(screen.getByRole('combobox', { name: /compute backend/i }), { target: { value: 'vulkan' } });
    fireEvent.click(screen.getByRole('button', { name: /download & start/i }));
    await waitFor(() => expect(bridge.startProvision).toHaveBeenCalledWith('vulkan', '8b'));
  });

  it('shows ready state when already provisioned', async () => {
    bridge.getProvisionStatus.mockResolvedValue({
      success: true,
      data: { state: 'done', step: 'done', progress: 1, log: [], provisioned: true, bundle: 'full', models: MODELS },
    });
    render(<ProvisionPanel />);
    await screen.findByText(/brain ready/i);
  });
});
