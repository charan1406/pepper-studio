import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as bridge from '../lib/bridge';
import { usePepperStore, useBridgeTarget } from './usePepperState';

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, setBridgeUrl: vi.fn() };
});

function Harness() {
  useBridgeTarget();
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  usePepperStore.setState({ mode: 'sim', robotBridgeUrl: '' });
});

describe('useBridgeTarget', () => {
  it('sim mode routes to app origin (empty URL)', () => {
    render(<Harness />);
    expect(bridge.setBridgeUrl).toHaveBeenLastCalledWith('');
  });

  it('real mode with a connected robot points at the robot bridge', () => {
    usePepperStore.setState({ mode: 'real', robotBridgeUrl: 'http://192.168.1.17:5001' });
    render(<Harness />);
    expect(bridge.setBridgeUrl).toHaveBeenLastCalledWith('http://192.168.1.17:5001');
  });

  it('real mode with no robot connected falls back to the simulator', () => {
    usePepperStore.setState({ mode: 'real', robotBridgeUrl: '' });
    render(<Harness />);
    expect(bridge.setBridgeUrl).toHaveBeenLastCalledWith('');
  });
});
