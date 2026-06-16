import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VoicePanel from './VoicePanel';
import * as bridge from '../lib/bridge';

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getVoiceStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'idle', transcript: [], error: '' } }),
    voiceTalk: vi.fn().mockResolvedValue({ success: true, data: { state: 'busy', transcript: [], error: '' } }),
    voiceClear: vi.fn().mockResolvedValue({ success: true, data: { state: 'idle', transcript: [], error: '' } }),
    getBridgeUrl: vi.fn(() => 'http://192.168.1.17:5001'),
    getSearxngUrl: vi.fn(() => 'http://localhost:8888'),
  };
});

beforeEach(() => vi.clearAllMocks());

describe('VoicePanel', () => {
  it('Talk sends the current bridge URL', async () => {
    render(<VoicePanel />);
    fireEvent.click(screen.getByRole('button', { name: /talk to pepper/i }));
    await waitFor(() => expect(bridge.voiceTalk).toHaveBeenCalled());
    const body = bridge.voiceTalk.mock.calls[0][0];
    expect(body.bridge_url).toBe('http://192.168.1.17:5001');
    expect(body.searxng_url).toBe('http://localhost:8888');
  });

  it('renders the transcript from status', async () => {
    bridge.getVoiceStatus.mockResolvedValue({
      success: true,
      data: { state: 'idle', error: '', transcript: [
        { role: 'user', text: 'hello', kind: 'en' },
        { role: 'pepper', text: 'Hi there!', kind: 'chat' },
      ] },
    });
    render(<VoicePanel />);
    expect(await screen.findByText(/Hi there!/)).toBeInTheDocument();
    expect(screen.getByText(/hello/)).toBeInTheDocument();
  });

  it('Clear calls voiceClear', async () => {
    render(<VoicePanel />);
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    await waitFor(() => expect(bridge.voiceClear).toHaveBeenCalled());
  });
});
