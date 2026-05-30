import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getBridgeUrl, setBridgeUrl, BRIDGE_URL_KEY,
  moveVelocity, stopMove, setPosture, speak, stopSpeak,
  setEyeColor, listAnimations, runAnimation, setHead, navigateTo,
} from './bridge';

function mockFetch(jsonBody = { success: true, data: {} }, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok, status,
    json: async () => jsonBody,
  });
  globalThis.fetch = fn;
  return fn;
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('bridge URL setting', () => {
  it('defaults to window.location.origin', () => {
    expect(getBridgeUrl()).toBe(window.location.origin);
  });

  it('returns a saved URL with trailing slash stripped', () => {
    setBridgeUrl('http://192.168.1.50:5001/');
    expect(getBridgeUrl()).toBe('http://192.168.1.50:5001');
    expect(localStorage.getItem(BRIDGE_URL_KEY)).toBe('http://192.168.1.50:5001/');
  });

  it('clears back to origin when set empty', () => {
    setBridgeUrl('http://x:5001');
    setBridgeUrl('');
    expect(getBridgeUrl()).toBe(window.location.origin);
  });
});

describe('control calls', () => {
  it('moveVelocity POSTs JSON to /move/velocity', async () => {
    const fetchMock = mockFetch();
    await moveVelocity(0.5, 0, -0.3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`${window.location.origin}/move/velocity`);
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual({ x: 0.5, y: 0, theta: -0.3 });
  });

  it('stopMove POSTs empty object to /move/stop', async () => {
    const fetchMock = mockFetch();
    await stopMove();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`${window.location.origin}/move/stop`);
    expect(JSON.parse(opts.body)).toEqual({});
  });

  it('setPosture defaults speed to 0.5', async () => {
    const fetchMock = mockFetch();
    await setPosture('Stand');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ posture: 'Stand', speed: 0.5 });
  });

  it('speak defaults language to en', async () => {
    const fetchMock = mockFetch();
    await speak('hello');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`${window.location.origin}/speak`);
    expect(JSON.parse(opts.body)).toEqual({ text: 'hello', language: 'en' });
  });

  it('stopSpeak hits /speak/stop', async () => {
    const fetchMock = mockFetch();
    await stopSpeak();
    expect(fetchMock.mock.calls[0][0]).toBe(`${window.location.origin}/speak/stop`);
  });

  it('setEyeColor sends r,g,b', async () => {
    const fetchMock = mockFetch();
    await setEyeColor(0, 255, 0);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('listAnimations GETs /animation/list and returns parsed json', async () => {
    const fetchMock = mockFetch({ success: true, data: { animations: ['a', 'b'] } });
    const res = await listAnimations();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`${window.location.origin}/animation/list`);
    expect(opts).toBeUndefined();
    expect(res.data.animations).toEqual(['a', 'b']);
  });

  it('runAnimation POSTs the name', async () => {
    const fetchMock = mockFetch();
    await runAnimation('animations/Stand/Gestures/Hey_1');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'animations/Stand/Gestures/Hey_1' });
  });

  it('setHead sends yaw,pitch,speed', async () => {
    const fetchMock = mockFetch();
    await setHead(0.1, -0.2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ yaw: 0.1, pitch: -0.2, speed: 0.2 });
  });

  it('navigateTo defaults theta to 0', async () => {
    const fetchMock = mockFetch();
    await navigateTo(1, 2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ x: 1, y: 2, theta: 0 });
  });

  it('throws on non-ok response', async () => {
    mockFetch({}, false, 500);
    await expect(stopMove()).rejects.toThrow(/500/);
  });

  it('uses the configured bridge URL', async () => {
    setBridgeUrl('http://robot.local:5001');
    const fetchMock = mockFetch();
    await stopMove();
    expect(fetchMock.mock.calls[0][0]).toBe('http://robot.local:5001/move/stop');
  });
});
