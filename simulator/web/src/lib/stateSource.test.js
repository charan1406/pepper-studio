import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStateSource } from './stateSource';

// Controllable fake WebSocket (jsdom has no WebSocket; we inject this).
class FakeWS {
  constructor(url) { this.url = url; this.readyState = 0; FakeWS.last = this; }
  close() { if (this.readyState === 3) return; this.readyState = 3; this.onclose && this.onclose(); }
  _open() { this.readyState = 1; this.onopen && this.onopen(); }
  _msg(obj) { this.onmessage && this.onmessage({ data: JSON.stringify(obj) }); }
}

beforeEach(() => { vi.useFakeTimers(); FakeWS.last = null; });
afterEach(() => { vi.useRealTimers(); });

function make(opts) {
  return createStateSource({
    wsUrl: 'ws://x:5003',
    getState: vi.fn().mockResolvedValue({ success: true, data: { battery: 42 } }),
    onData: vi.fn(),
    onSource: vi.fn(),
    wsTimeoutMs: 2000,
    pollIntervalMs: 100,
    WebSocketImpl: FakeWS,
    ...opts,
  });
}

it('uses the WS when it opens and pipes parsed messages', () => {
  const onData = vi.fn(), onSource = vi.fn();
  const s = make({ onData, onSource });
  s.start();
  FakeWS.last._open();
  expect(onSource).toHaveBeenCalledWith('ws');
  FakeWS.last._msg({ battery: 90 });
  expect(onData).toHaveBeenCalledWith({ battery: 90 });
  s.stop();
});

it('falls back to polling when the WS never opens', async () => {
  const getState = vi.fn().mockResolvedValue({ success: true, data: { battery: 42 } });
  const onData = vi.fn(), onSource = vi.fn();
  const s = make({ getState, onData, onSource });
  s.start();
  await vi.advanceTimersByTimeAsync(2000); // WS timeout → close → poll → first tick resolves
  expect(onSource).toHaveBeenCalledWith('poll');
  expect(onData).toHaveBeenCalledWith({ battery: 42 }); // unwrapped .data
  s.stop();
});

it('forceSource "poll" never constructs a WebSocket', async () => {
  const getState = vi.fn().mockResolvedValue({ success: true, data: { battery: 50 } });
  const onData = vi.fn(), onSource = vi.fn();
  const s = make({ getState, onData, onSource, forceSource: 'poll' });
  s.start();
  expect(FakeWS.last).toBe(null);
  await vi.advanceTimersByTimeAsync(1);
  expect(onSource).toHaveBeenCalledWith('poll');
  expect(onData).toHaveBeenCalledWith({ battery: 50 });
  s.stop();
});

it('reports disconnected when a poll fails', async () => {
  const getState = vi.fn().mockRejectedValue(new Error('down'));
  const onSource = vi.fn();
  const s = make({ getState, onSource, forceSource: 'poll' });
  s.start();
  await vi.advanceTimersByTimeAsync(1);
  expect(onSource).toHaveBeenCalledWith('disconnected');
  s.stop();
});

it('reconnects the WS (stays out of poll mode) after an opened connection drops', () => {
  const onSource = vi.fn();
  const s = make({ onSource });
  s.start();
  FakeWS.last._open();
  const first = FakeWS.last;
  first.close();                       // opened-then-closed → reconnect, not poll
  expect(onSource).toHaveBeenCalledWith('disconnected');
  vi.advanceTimersByTime(2000);        // reconnect timer fires
  expect(FakeWS.last).not.toBe(first); // a new WS was constructed
  s.stop();
});
