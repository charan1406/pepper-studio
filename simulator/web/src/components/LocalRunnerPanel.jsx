import React, { useState, useEffect, useRef } from 'react';
import { getRunnerStatus, listModels, startRunner, stopRunner } from '../lib/bridge';
import { Button } from '../design';

const CACHE_TYPES = ['', 'f16', 'q8_0', 'q4_0'];

const FIELD = 'w-full rounded-md bg-surface-1 border border-border px-2.5 py-2 text-sm text-text '
  + 'placeholder:text-dim focus:outline-none focus:border-accent/60 focus:ring-[3px] focus:ring-accent-soft';

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
  const stateTone = status.state === 'ready' ? 'text-ok' : status.state === 'error' ? 'text-danger' : 'text-warn';

  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex gap-1.5">
        <input className={FIELD} value={dir} placeholder="models dir (e.g. ~/models/gguf)"
          onChange={(e) => setDir(e.target.value)} />
        <Button variant="secondary" onClick={onScan}>Scan</Button>
      </div>
      <select className={FIELD} value={gguf} onChange={(e) => setGguf(e.target.value)}>
        {models.length === 0 && <option value="">(scan a models dir)</option>}
        {models.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-1.5">
        <input className={FIELD} value={ngl} placeholder="-ngl (GPU layers)" onChange={(e) => setNgl(e.target.value)} />
        <input className={FIELD} value={ctx} placeholder="-c (ctx size)" onChange={(e) => setCtx(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-1.5 items-center">
        <select className={FIELD} value={cacheType} onChange={(e) => setCacheType(e.target.value)}>
          {CACHE_TYPES.map((t) => <option key={t} value={t}>{t ? `KV ${t}` : 'KV default'}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[10px] text-dim">
          <input type="checkbox" checked={flashAttn} onChange={(e) => setFlashAttn(e.target.checked)} /> flash-attn (-fa)
        </label>
      </div>
      <input className={FIELD} value={mmproj} placeholder="--mmproj (vision, optional)" onChange={(e) => setMmproj(e.target.value)} />
      <input className={FIELD} value={extra} placeholder="extra args (e.g. --threads 6)" onChange={(e) => setExtra(e.target.value)} />
      <input className={FIELD} value={binary} placeholder="llama-server path (blank = use PATH)" onChange={(e) => setBinary(e.target.value)} />
      <div className="grid grid-cols-2 gap-1.5">
        <Button onClick={onStart} disabled={!gguf}>Start</Button>
        <Button variant="secondary" onClick={onStop}>Stop</Button>
      </div>
      <div className="pt-0.5">
        <span className={'text-[10px] font-semibold ' + stateTone}>● {status.state}</span>
        {status.error && <span className="text-[10px] text-dim ml-1.5">{status.error}</span>}
      </div>
      {noBinary && (
        <div className="text-[10px] text-dim">
          No llama-server found — see <strong>LLAMA_SETUP.md</strong> in the repo to install it.
        </div>
      )}
      <div ref={logRef} className="h-[120px] overflow-y-auto bg-bg border border-border rounded-md p-1.5 text-[10px] font-mono text-muted whitespace-pre-wrap">
        {(status.log || []).join('\n')}
      </div>
    </div>
  );
}
