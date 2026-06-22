import React, { useState, useEffect, useRef } from 'react';
import { getProvisionStatus, startProvision } from '../lib/bridge';
import { Button } from '../design';

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
  const stateTone = done ? 'text-ok' : status.state === 'error' ? 'text-danger' : busy ? 'text-warn' : 'text-muted';

  return (
    <div className="mt-1">
      <div className="text-sm text-text font-semibold mb-1">Set up the AI brain</div>
      <div className="text-[10px] text-dim">
        Downloads a llama.cpp engine + a recommended model (Qwen2.5 3B) and starts it for you.
        No accounts, no setup. One-time ~2 GB download.
      </div>
      <div className="mt-2 space-y-2">
        <select value={backend} disabled={busy} onChange={(e) => setBackend(e.target.value)}
          className="w-full rounded-md bg-surface-1 border border-border px-2.5 py-2 text-sm text-text
                     focus:outline-none focus:border-accent/60 focus:ring-[3px] focus:ring-accent-soft disabled:opacity-50">
          {BACKENDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <Button className="w-full" onClick={onStart} disabled={busy}>
          {done ? 'Re-download & restart' : busy ? 'Working…' : 'Download & start'}
        </Button>
      </div>

      <div className="mt-2">
        <span className={'text-[10px] font-semibold ' + stateTone}>● {status.state}</span>
        {status.backend && <span className="text-[10px] text-dim ml-1.5">backend: {status.backend}</span>}
        {status.step && status.step !== 'done' && (
          <span className="text-[10px] text-dim ml-1.5">{STEP_LABEL[status.step] || status.step}</span>
        )}
      </div>
      {(busy || done) && (
        <div className="h-1.5 bg-surface-1 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.round((done ? 1 : (status.progress || 0)) * 100)}%` }} />
        </div>
      )}
      {status.error && <div className="text-[10px] text-danger mt-1.5">{status.error}</div>}
      {done && !busy && <div className="text-[10px] text-ok mt-1.5">Brain ready — the AI is now running locally.</div>}
      {(status.log || []).length > 0 && (
        <div ref={logRef} className="mt-2 h-[110px] overflow-y-auto bg-bg border border-border rounded-md p-1.5 text-[10px] font-mono text-muted whitespace-pre-wrap">
          {(status.log || []).join('\n')}
        </div>
      )}
    </div>
  );
}
