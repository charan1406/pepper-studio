import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ServicesPanel from './ServicesPanel';
import * as bridge from '../lib/bridge';

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getServicesStatus: vi.fn().mockResolvedValue({ success: true, data: { searxng: { running: false, present: true, error: '' } } }),
    startSearxng: vi.fn().mockResolvedValue({ success: true, data: { running: true, present: true, error: '' } }),
    stopSearxng: vi.fn().mockResolvedValue({ success: true, data: { running: false, present: true, error: '' } }),
    getRunnerStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'ready' } }),
  };
});

beforeEach(() => vi.clearAllMocks());

describe('ServicesPanel', () => {
  it('shows Start when SearXNG is stopped and calls startSearxng', async () => {
    render(<ServicesPanel />);
    const btn = await screen.findByRole('button', { name: /^start$/i });
    fireEvent.click(btn);
    await waitFor(() => expect(bridge.startSearxng).toHaveBeenCalled());
  });

  it('shows Stop when SearXNG is running', async () => {
    bridge.getServicesStatus.mockResolvedValue({ success: true, data: { searxng: { running: true, present: true, error: '' } } });
    render(<ServicesPanel />);
    await screen.findByRole('button', { name: /^stop$/i });
  });

  it('reflects llama runner state', async () => {
    render(<ServicesPanel />);
    expect(await screen.findByText(/^ready$/)).toBeInTheDocument();
  });
});
