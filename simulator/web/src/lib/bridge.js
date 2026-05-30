// Pure HTTP client for the Pepper bridge contract.
// Bridge URL is a user setting (default: same origin) — the SP2 real-robot hook.
export const BRIDGE_URL_KEY = 'pepper_bridge_url';

export function getBridgeUrl() {
  try {
    const saved = localStorage.getItem(BRIDGE_URL_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
  } catch {
    // localStorage unavailable — fall through to origin
  }
  return window.location.origin;
}

export function setBridgeUrl(url) {
  try {
    if (url && url.trim()) localStorage.setItem(BRIDGE_URL_KEY, url.trim());
    else localStorage.removeItem(BRIDGE_URL_KEY);
  } catch {
    // ignore — settings just won't persist
  }
}

async function post(path, body = {}) {
  const res = await fetch(`${getBridgeUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → HTTP ${res.status}`);
  return res.json();
}

async function get(path) {
  const res = await fetch(`${getBridgeUrl()}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json();
}

export const moveVelocity = (x, y, theta) => post('/move/velocity', { x, y, theta });
export const stopMove = () => post('/move/stop', {});
export const setPosture = (posture, speed = 0.5) => post('/posture/set', { posture, speed });
export const speak = (text, language = 'en') => post('/speak', { text, language });
export const stopSpeak = () => post('/speak/stop', {});
export const setEyeColor = (r, g, b) => post('/leds/eyes', { r, g, b });
export const listAnimations = () => get('/animation/list');
export const runAnimation = (name) => post('/animation/run', { name });
export const setHead = (yaw, pitch, speed = 0.2) => post('/head/set', { yaw, pitch, speed });
export const navigateTo = (x, y, theta = 0) => post('/navigate/goto', { x, y, theta });

// Posture + head-limit constants (from sim_state.py) for the UI.
export const POSTURES = ['Stand', 'StandInit', 'StandZero', 'Crouch', 'Sit', 'SitRelax'];
export const HEAD_LIMITS = { yaw: [-2.0857, 2.0857], pitch: [-0.7068, 0.6371] };
