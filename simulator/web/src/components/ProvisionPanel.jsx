import React, { useState, useEffect, useRef } from 'react';
import { getProvisionStatus, startProvision } from '../lib/bridge';

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
  const lamp = done ? 'hmi-lamp-on' : status.state === 'error' ? 'hmi-lamp-red' : 'hmi-lamp-off';

  return (
    <div className="mt-1">
      <div className="hmi-engrave text-sm font-bold mb-1">Set up the AI brain</div>
      <div className="hmi-engrave text-[10px] opacity-60 leading-relaxed">
        Downloads a llama.cpp engine + a recommended model (Qwen2.5 3B) and starts it for you.
        No accounts, no setup. One-time ~2 GB download.
      </div>
      <div className="mt-2.5 space-y-2.5">
        <select value={backend} disabled={busy} onChange={(e) => setBackend(e.target.value)}
          className="hmi-field w-full px-2.5 py-2.5 text-sm disabled:opacity-50">
          {BACKENDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <button className="hmi-key hmi-key-go w-full px-3 py-2.5 text-[13px] font-semibold rounded-md disabled:opacity-45"
          onClick={onStart} disabled={busy}>
          {done ? 'Re-download & restart' : busy ? 'Working…' : 'Download & start'}
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <span className={'hmi-lamp ' + lamp} />
        <span className="hmi-engrave text-[11px] font-semibold">{status.state}</span>
        {status.backend && <span className="hmi-engrave text-[10px] opacity-60">· {status.backend}</span>}
        {status.step && status.step !== 'done' && (
          <span className="hmi-engrave text-[10px] opacity-60">· {STEP_LABEL[status.step] || status.step}</span>
        )}
      </div>
      {(busy || done) && (
        <div className="h-2 bg-black/40 rounded-full overflow-hidden mt-2 border border-white/5">
          <div className="h-full bg-[#34d860] transition-[width] duration-300"
            style={{ width: `${Math.round((done ? 1 : (status.progress || 0)) * 100)}%`, boxShadow: '0 0 8px rgba(52,216,96,.6)' }} />
        </div>
      )}
      {status.error && <div className="hmi-engrave text-[10px] mt-1.5" style={{ color: '#f87171' }}>{status.error}</div>}
      {done && !busy && <div className="text-[10px] mt-1.5" style={{ color: '#6cf39a' }}>Brain ready — the AI is now running locally.</div>}
      {(status.log || []).length > 0 && (
        <div ref={logRef} className="hmi-lcd mt-2 h-[100px] overflow-y-auto rounded p-2 text-[10px] whitespace-pre-wrap">
          {(status.log || []).join('\n')}
        </div>
      )}
    </div>
  );
}
