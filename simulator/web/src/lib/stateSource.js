// Framework-free state-source controller for SP2.1.
// Tries the sim WebSocket; falls back to polling GET /state (real robot has no WS).
// Both paths feed the SAME normalized state object to onData:
//   - WS frames are the raw to_dict() shape (parsed straight through)
//   - poll responses are { success, data } → we hand onData the unwrapped `data`
//
// onSource reports 'ws' | 'poll' | 'disconnected' for the UI badge.
export function createStateSource({
  wsUrl,
  getState,                 // async () => ({ success, data })
  onData,                   // (stateObj) => void
  onSource,                 // ('ws'|'poll'|'disconnected') => void
  pollIntervalMs = 100,     // ~10 Hz
  wsTimeoutMs = 2000,
  forceSource = null,       // 'poll' to skip the WS entirely (dev override)
  WebSocketImpl = (typeof WebSocket !== 'undefined' ? WebSocket : null),
}) {
  let ws = null;
  let pollTimer = null;
  let wsTimeout = null;
  let reconnectTimer = null;
  let stopped = false;

  function startPolling() {
    if (pollTimer || stopped) return;
    onSource('poll');
    const tick = async () => {
      try {
        const resp = await getState();
        if (stopped) return;
        onData(resp && resp.data ? resp.data : resp);
        onSource('poll');
      } catch {
        if (!stopped) onSource('disconnected');
      }
    };
    tick();
    pollTimer = setInterval(tick, pollIntervalMs);
  }

  function startWs() {
    if (stopped) return;
    if (!WebSocketImpl) { startPolling(); return; }
    let opened = false;
    ws = new WebSocketImpl(wsUrl);

    wsTimeout = setTimeout(() => {
      if (!opened) { try { ws && ws.close(); } catch {} startPolling(); }
    }, wsTimeoutMs);

    ws.onopen = () => { opened = true; clearTimeout(wsTimeout); onSource('ws'); };
    ws.onmessage = (e) => { try { onData(JSON.parse(e.data)); } catch {} };
    ws.onerror = () => { try { ws && ws.close(); } catch {} };
    ws.onclose = () => {
      clearTimeout(wsTimeout);
      if (stopped) return;
      if (opened) {
        // The sim WS dropped — reconnect, stay in WS mode (don't degrade to poll).
        onSource('disconnected');
        reconnectTimer = setTimeout(startWs, 2000);
      } else {
        // Never opened (real robot has no WS) — poll instead.
        startPolling();
      }
    };
  }

  return {
    start() {
      stopped = false;
      if (forceSource === 'poll') startPolling();
      else startWs();
    },
    stop() {
      stopped = true;
      clearTimeout(wsTimeout);
      clearTimeout(reconnectTimer);
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (ws) { try { ws.close(); } catch {} ws = null; }
    },
  };
}
