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

// SearXNG URL is a user setting too (web search for the in-app voice loop).
// Defaults to the common local container port; '' disables web search.
export const SEARXNG_URL_KEY = 'pepper_searxng_url';

export function getSearxngUrl() {
  try {
    const saved = localStorage.getItem(SEARXNG_URL_KEY);
    if (saved !== null) return saved.trim().replace(/\/+$/, '');
  } catch {
    // fall through to default
  }
  return 'http://localhost:8888';
}

export function setSearxngUrl(url) {
  try {
    localStorage.setItem(SEARXNG_URL_KEY, (url || '').trim());
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

// Studio-side endpoints (AI config, llama runner, robot connection) live on the
// Studio backend, NOT the bridge — they must hit the app's own origin, never the
// bridge URL (which after connecting points at the robot, which has none of
// these). Keep them separate from the bridge-contract helpers above.
async function studioPost(path, body = {}) {
  const res = await fetch(`${window.location.origin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → HTTP ${res.status}`);
  return res.json();
}

async function studioGet(path) {
  const res = await fetch(`${window.location.origin}${path}`);
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

// AI provider config (runtime dial). api_key is never returned by the bridge.
export const getAiConfig = () => studioGet('/ai/config');
export const setAiConfig = (cfg) => studioPost('/ai/config', cfg);
export const testAiConfig = (cfg) => studioPost('/ai/test', cfg);

// Local model runner (llama-server sidecar).
export const getRunnerStatus = () => studioGet('/ai/runner/status');
export const listModels = (dir) => studioGet(`/ai/runner/models?dir=${encodeURIComponent(dir || '')}`);
export const startRunner = (body) => studioPost('/ai/runner/start', body);
export const stopRunner = () => studioPost('/ai/runner/stop', {});

// Robot connection (studio-side; deploys + runs bridge.py on a real Pepper).
export const getRobotStatus = () => studioGet('/robot/status');
export const connectRobot = (body) => studioPost('/robot/connect', body);
export const disconnectRobot = () => studioPost('/robot/disconnect', {});

// In-app voice (studio-side; push-to-talk one turn against the current bridge).
export const getVoiceStatus = () => studioGet('/voice/status');
export const voiceTalk = (body) => studioPost('/voice/talk', body);
export const voiceClear = () => studioPost('/voice/clear', {});

// External services (studio-side; docker-managed SearXNG for web search).
export const getServicesStatus = () => studioGet('/services/status');
export const startSearxng = () => studioPost('/services/searxng/start', {});
export const stopSearxng = () => studioPost('/services/searxng/stop', {});

// Posture + head-limit constants (from sim_state.py) for the UI.
export const POSTURES = ['Stand', 'StandInit', 'StandZero', 'Crouch', 'Sit', 'SitRelax'];
export const HEAD_LIMITS = { yaw: [-2.0857, 2.0857], pitch: [-0.7068, 0.6371] };
