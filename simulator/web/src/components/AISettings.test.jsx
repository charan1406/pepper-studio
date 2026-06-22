import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AISettings from './AISettings';
import * as bridge from '../lib/bridge';
import { usePepperStore } from '../hooks/usePepperState';

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAiConfig: vi.fn().mockResolvedValue({ success: true, data: { base_url: 'http://x/v1', model: 'm', timeout: 60, enabled: true, key_set: true } }),
    setAiConfig: vi.fn().mockResolvedValue({ success: true, data: { base_url: 'http://x/v1', model: 'm', timeout: 60, enabled: true, key_set: true } }),
    testAiConfig: vi.fn().mockResolvedValue({ success: true, data: { tok_per_sec: 12 } }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  usePepperStore.setState({ aiPanelOpen: false, aiInitialSource: null });
});

describe('AISettings', () => {
  it('loads config on mount and never shows the key', async () => {
    render(<AISettings />);
    await waitFor(() => expect(bridge.getAiConfig).toHaveBeenCalled());
    const keyField = screen.getByPlaceholderText(/key stored|api key/i);
    expect(keyField.value).toBe('');
  });

  it('Save omits api_key when untouched, includes it when typed', async () => {
    render(<AISettings />);
    await waitFor(() => expect(bridge.getAiConfig).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(bridge.setAiConfig.mock.calls[0][0]).not.toHaveProperty('api_key');

    await userEvent.type(screen.getByPlaceholderText(/key stored|api key/i), 'NEWKEY');
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(bridge.setAiConfig.mock.calls[1][0].api_key).toBe('NEWKEY');
  });

  it('Test button calls testAiConfig', async () => {
    render(<AISettings />);
    await waitFor(() => expect(bridge.getAiConfig).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /^test$/i }));
    expect(bridge.testAiConfig).toHaveBeenCalled();
  });
});
