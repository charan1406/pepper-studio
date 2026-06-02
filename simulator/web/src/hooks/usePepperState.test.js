import { describe, it, expect, beforeEach } from 'vitest';
import { usePepperStore } from './usePepperState';

beforeEach(() => {
  usePepperStore.setState({ connected: false, source: 'disconnected' });
});

describe('store source/connected', () => {
  it('setSource("ws") marks connected', () => {
    usePepperStore.getState().setSource('ws');
    expect(usePepperStore.getState().source).toBe('ws');
    expect(usePepperStore.getState().connected).toBe(true);
  });

  it('setSource("poll") marks connected', () => {
    usePepperStore.getState().setSource('poll');
    expect(usePepperStore.getState().connected).toBe(true);
  });

  it('setSource("disconnected") clears connected', () => {
    usePepperStore.getState().setSource('ws');
    usePepperStore.getState().setSource('disconnected');
    expect(usePepperStore.getState().source).toBe('disconnected');
    expect(usePepperStore.getState().connected).toBe(false);
  });
});
