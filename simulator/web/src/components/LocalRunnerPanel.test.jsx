import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LocalRunnerPanel from './LocalRunnerPanel';
import * as bridge from '../lib/bridge';

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getRunnerStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'stopped', log: [] } }),
    listModels: vi.fn().mockResolvedValue({ success: true, data: { dir: '/m', models: ['qwen-4b.gguf'] } }),
    startRunner: vi.fn().mockResolvedValue({ success: true, data: { state: 'starting' } }),
    stopRunner: vi.fn().mockResolvedValue({ success: true, data: { state: 'stopped' } }),
  };
});

beforeEach(() => vi.clearAllMocks());

describe('LocalRunnerPanel', () => {
  it('scan lists models into the dropdown', async () => {
    render(<LocalRunnerPanel />);
    fireEvent.click(screen.getByRole('button', { name: /scan/i }));
    await waitFor(() => expect(bridge.listModels).toHaveBeenCalled());
    await screen.findByRole('option', { name: /qwen-4b\.gguf/ });
  });

  it('Start sends the selected gguf + flags', async () => {
    render(<LocalRunnerPanel />);
    fireEvent.click(screen.getByRole('button', { name: /scan/i }));
    await screen.findByRole('option', { name: /qwen-4b\.gguf/ });
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    await waitFor(() => expect(bridge.startRunner).toHaveBeenCalled());
    expect(bridge.startRunner.mock.calls[0][0].gguf).toBe('qwen-4b.gguf');
  });

  it('Stop calls stopRunner', async () => {
    render(<LocalRunnerPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    await waitFor(() => expect(bridge.stopRunner).toHaveBeenCalled());
  });
});
