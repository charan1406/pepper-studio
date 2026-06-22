import React, { useState, useEffect, useRef } from 'react';
import { getProvisionStatus, startProvision } from '../lib/bridge';

const S = {
  select: { width: '100%', padding: '8px 10px', background: '#1c1c1e', border: '1px solid #3a3a3c', borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', outline: 'none', fontFamily: 'inherit', marginBottom: '8px', boxSizing: 'border-box' },
  primary: { width: '100%', padding: '10px 12px', background: '#8aba8a', border: 'none', borderRadius: '6px', color: '#1c1c1e', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  bar: { height: '6px', background: '#1c1c1e', borderRadius: '3px', overflow: 'hidden', marginTop: '8px' },
  fill: (p) => ({ height: '100%', width: `${Math.round(p * 100)}%`, background: '#8aba8a', transition: 'width .3s' }),
  log: { marginTop: '8px', height: '110px', overflowY: 'auto', background: '#0e0e10', border: '1px solid #3a3a3c', borderRadius: '6px', padding: '6px', fontSize: '10px', fontFamily: 'monospace', color: '#9aa', whiteSpace: 'pre-wrap' },
  note: { fontSize: '10px', color: '#666', marginTop: '6px' },
  badge: (s) => ({ fontSize: '10px', fontWeight: 600, color: s === 'done' ? '#8aba8a' : s === 'error' ? '#ba8a8a' : s === 'running' ? '#d4a847' : '#999' }),
  head: { fontSize: '12px', color: '#e5e5e5', fontWeight: 600, marginBottom: '4px' },
};

// CUDA is Windows-only (no Linux prebuilt); the backend rejects bad combos clearly.
const BACKENDS = [
  ['', 'Auto-detect (recommended)'],
  ['vulkan', 'Vulkan — any GPU (NVIDIA/AMD/Intel)'],
  ['cuda', 'CUDA — NVIDIA (Windows only)'],
  ['metal', 'Metal — Apple Silicon'],
  ['cpu', 'CPU only'],
];

const STEP_LABEL = {
  resolve: 'Resolving release…',
  'download-binary': 'Downloading llama.cpp…',
  'extract-binary': 'Extracting…',
  'download-model': 'Downloading model (~2 GB, first run only)…',
  done: 'Ready',
};

export default function ProvisionPanel() {
  const [backend, setBackend] = useState('');
  const [status, setStatus] = useState({ state: 'idle', step: '', progress: 0, log: [], provisioned: false });
  const logRef = useRef(null);

  const refresh = () => getProvisionStatus().then((r) => { if (r?.data) setStatus(r.data); }).catch(() => {});

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [status.log]);

  const onStart = async () => {
    const r = await startProvision(backend);
    if (r?.data) setStatus(r.data);
  };

  const busy = status.state === 'running';
  const done = status.state === 'done' || status.provisioned;

  return (
    <div style={{ marginTop: '4px' }}>
      <div style={S.head}>Set up the AI brain</div>
      <div style={S.note}>
        Downloads a llama.cpp engine + a recommended model (Qwen2.5 3B) and starts it for you.
        No accounts, no setup. One-time ~2 GB download.
      </div>
      <div style={{ marginTop: '8px' }}>
        <select style={S.select} value={backend} disabled={busy}
          onChange={(e) => setBackend(e.target.value)}>
          {BACKENDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <button style={S.primary} onClick={onStart} disabled={busy}>
          {done ? 'Re-download & restart' : busy ? 'Working…' : 'Download & start'}
        </button>
      </div>

      <div style={{ marginTop: '8px' }}>
        <span style={S.badge(status.state)}>● {status.state}</span>
        {status.backend && <span style={{ ...S.note, marginLeft: '6px' }}>backend: {status.backend}</span>}
        {status.step && status.step !== 'done' && (
          <span style={{ ...S.note, marginLeft: '6px' }}>{STEP_LABEL[status.step] || status.step}</span>
        )}
      </div>
      {(busy || done) && <div style={S.bar}><div style={S.fill(done ? 1 : (status.progress || 0))} /></div>}
      {status.error && <div style={{ ...S.note, color: '#ba8a8a' }}>{status.error}</div>}
      {done && !busy && <div style={{ ...S.note, color: '#8aba8a' }}>Brain ready — the AI is now running locally.</div>}
      {(status.log || []).length > 0 && <div ref={logRef} style={S.log}>{(status.log || []).join('\n')}</div>}
    </div>
  );
}
