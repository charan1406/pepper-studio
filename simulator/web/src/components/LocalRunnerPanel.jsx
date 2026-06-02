import React, { useState, useEffect, useRef } from 'react';
import { getRunnerStatus, listModels, startRunner, stopRunner } from '../lib/bridge';

const S = {
  input: { width: '100%', padding: '8px 10px', background: '#1c1c1e', border: '1px solid #3a3a3c', borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', outline: 'none', fontFamily: 'inherit', marginBottom: '6px', boxSizing: 'border-box' },
  btn: { padding: '8px 10px', background: '#3a3a3c', border: '1px solid #4a4a4c', borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' },
  primary: { padding: '8px 12px', background: '#8aba8a', border: 'none', borderRadius: '6px', color: '#1c1c1e', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  row: { display: 'flex', gap: '6px' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' },
  log: { marginTop: '8px', height: '120px', overflowY: 'auto', background: '#0e0e10', border: '1px solid #3a3a3c', borderRadius: '6px', padding: '6px', fontSize: '10px', fontFamily: 'monospace', color: '#9aa', whiteSpace: 'pre-wrap' },
  badge: (s) => ({ fontSize: '10px', fontWeight: 600, color: s === 'ready' ? '#8aba8a' : s === 'error' ? '#ba8a8a' : '#d4a847' }),
  note: { fontSize: '10px', color: '#666', marginTop: '6px' },
};

const CACHE_TYPES = ['', 'f16', 'q8_0', 'q4_0'];

export default function LocalRunnerPanel() {
  const [dir, setDir] = useState('');
  const [models, setModels] = useState([]);
  const [gguf, setGguf] = useState('');
  const [binary, setBinary] = useState('');
  const [ngl, setNgl] = useState('');
  const [ctx, setCtx] = useState('');
  const [cacheType, setCacheType] = useState('');
  const [flashAttn, setFlashAttn] = useState(false);
  const [mmproj, setMmproj] = useState('');
  const [extra, setExtra] = useState('');
  const [status, setStatus] = useState({ state: 'stopped', log: [] });
  const logRef = useRef(null);

  const refresh = () => getRunnerStatus().then((r) => { if (r?.data) setStatus(r.data); }).catch(() => {});

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [status.log]);

  const onScan = async () => {
    const r = await listModels(dir);
    const list = r?.data?.models ?? [];
    setModels(list);
    if (list.length && !gguf) setGguf(list[0]);
    if (r?.data?.dir) setDir(r.data.dir);
  };

  const onStart = async () => {
    const body = { gguf, models_dir: dir, binary, extra_args: extra, flash_attn: flashAttn };
    if (ngl !== '') body.ngl = Number(ngl);
    if (ctx !== '') body.ctx = Number(ctx);
    if (cacheType) body.cache_type = cacheType;
    if (mmproj) body.mmproj = mmproj;
    const r = await startRunner(body);
    if (r?.data) setStatus(r.data);
  };

  const onStop = async () => { const r = await stopRunner(); if (r?.data) setStatus(r.data); };

  const noBinary = status.state === 'error' && /not found/i.test(status.error || '');

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={S.row}>
        <input style={S.input} value={dir} placeholder="models dir (e.g. ~/models/gguf)"
          onChange={(e) => setDir(e.target.value)} />
        <button style={S.btn} onClick={onScan}>Scan</button>
      </div>
      <select style={S.input} value={gguf} onChange={(e) => setGguf(e.target.value)}>
        {models.length === 0 && <option value="">(scan a models dir)</option>}
        {models.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <div style={S.grid2}>
        <input style={S.input} value={ngl} placeholder="-ngl (GPU layers)" onChange={(e) => setNgl(e.target.value)} />
        <input style={S.input} value={ctx} placeholder="-c (ctx size)" onChange={(e) => setCtx(e.target.value)} />
      </div>
      <div style={S.grid2}>
        <select style={S.input} value={cacheType} onChange={(e) => setCacheType(e.target.value)}>
          {CACHE_TYPES.map((t) => <option key={t} value={t}>{t ? `KV ${t}` : 'KV default'}</option>)}
        </select>
        <label style={{ ...S.note, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={flashAttn} onChange={(e) => setFlashAttn(e.target.checked)} /> flash-attn (-fa)
        </label>
      </div>
      <input style={S.input} value={mmproj} placeholder="--mmproj (vision, optional)" onChange={(e) => setMmproj(e.target.value)} />
      <input style={S.input} value={extra} placeholder="extra args (e.g. --threads 6)" onChange={(e) => setExtra(e.target.value)} />
      <input style={S.input} value={binary} placeholder="llama-server path (blank = use PATH)" onChange={(e) => setBinary(e.target.value)} />
      <div style={S.grid2}>
        <button style={S.primary} onClick={onStart} disabled={!gguf}>Start</button>
        <button style={S.btn} onClick={onStop}>Stop</button>
      </div>
      <div style={{ marginTop: '6px' }}>
        <span style={S.badge(status.state)}>● {status.state}</span>
        {status.error && <span style={{ ...S.note, marginLeft: '6px' }}>{status.error}</span>}
      </div>
      {noBinary && (
        <div style={S.note}>
          No llama-server found — see <strong>LLAMA_SETUP.md</strong> in the repo to install it.
        </div>
      )}
      <div ref={logRef} style={S.log}>{(status.log || []).join('\n')}</div>
    </div>
  );
}
