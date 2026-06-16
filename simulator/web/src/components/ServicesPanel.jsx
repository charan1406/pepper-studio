import React, { useState, useEffect } from 'react';
import { getServicesStatus, startSearxng, stopSearxng, getRunnerStatus } from '../lib/bridge';

const S = {
  btn: { padding: '6px 10px', background: '#3a3a3c', border: '1px solid #4a4a4c', borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' },
  primary: { padding: '6px 10px', background: '#8aba8a', border: 'none', borderRadius: '6px', color: '#1c1c1e', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  row: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  name: { fontSize: '12px', color: '#e5e5e5', minWidth: '64px' },
  dot: (on) => ({ width: '8px', height: '8px', borderRadius: '50%', background: on ? '#8aba8a' : '#6a6a6c', display: 'inline-block' }),
  state: (on) => ({ fontSize: '11px', color: on ? '#8aba8a' : '#888', minWidth: '64px' }),
  note: { fontSize: '10px', color: '#666', marginTop: '4px' },
};

export default function ServicesPanel() {
  const [searxng, setSearxng] = useState({ running: false, present: false, error: '' });
  const [runner, setRunner] = useState({ state: 'stopped' });

  const refresh = () => {
    getServicesStatus().then((r) => { if (r?.data?.searxng) setSearxng(r.data.searxng); }).catch(() => {});
    getRunnerStatus().then((r) => { if (r?.data) setRunner(r.data); }).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  const onStart = async () => { const r = await startSearxng(); if (r?.data) setSearxng(r.data); };
  const onStop = async () => { const r = await stopSearxng(); if (r?.data) setSearxng(r.data); };

  const llamaOn = runner.state === 'ready';

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={S.row}>
        <span style={S.dot(searxng.running)} />
        <span style={S.name}>SearXNG</span>
        <span style={S.state(searxng.running)}>{searxng.running ? 'running' : 'stopped'}</span>
        {searxng.running
          ? <button style={{ ...S.btn, marginLeft: 'auto' }} onClick={onStop}>Stop</button>
          : <button style={{ ...S.primary, marginLeft: 'auto' }} onClick={onStart}>Start</button>}
      </div>
      <div style={S.row}>
        <span style={S.dot(llamaOn)} />
        <span style={S.name}>llama</span>
        <span style={S.state(llamaOn)}>{runner.state}</span>
        <span style={{ ...S.note, marginLeft: 'auto', marginTop: 0 }}>manage in AI ▸</span>
      </div>
      {searxng.error && <div style={S.note}>{searxng.error}</div>}
    </div>
  );
}
