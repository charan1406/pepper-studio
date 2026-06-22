import React, { useState, useEffect, useRef } from 'react';
import { getRunnerStatus, listModels, startRunner, stopRunner } from '../lib/bridge';

const CACHE_TYPES = ['', 'f16', 'q8_0', 'q4_0'];

const FIELD = 'hmi-field w-full px-2.5 py-2 text-sm';
const KEY = 'hmi-key px-3 py-2 text-[13px] font-semibold rounded-md';

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
  const lamp = status.state === 'ready' ? 'hmi-lamp-on' : status.state === 'error' ? 'hmi-lamp-red' : 'hmi-lamp-off';

  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex gap-2">
        <input className={FIELD} value={dir} placeholder="models dir (e.g. ~/models/gguf)"
          onChange={(e) => setDir(e.target.value)} />
        <button className={KEY} onClick={onScan}>Scan</button>
      </div>
      <select className={FIELD} value={gguf} onChange={(e) => setGguf(e.target.value)}>
        {models.length === 0 && <option value="">(scan a models dir)</option>}
        {models.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input className={FIELD} value={ngl} placeholder="-ngl (GPU layers)" onChange={(e) => setNgl(e.target.value)} />
        <input className={FIELD} value={ctx} placeholder="-c (ctx size)" onChange={(e) => setCtx(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2 items-center">
        <select className={FIELD} value={cacheType} onChange={(e) => setCacheType(e.target.value)}>
          {CACHE_TYPES.map((t) => <option key={t} value={t}>{t ? `KV ${t}` : 'KV default'}</option>)}
        </select>
        <label className="hmi-engrave flex items-center gap-1.5 text-[10px] opacity-70">
          <input type="checkbox" checked={flashAttn} onChange={(e) => setFlashAttn(e.target.checked)} /> flash-attn (-fa)
        </label>
      </div>
      <input className={FIELD} value={mmproj} placeholder="--mmproj (vision, optional)" onChange={(e) => setMmproj(e.target.value)} />
      <input className={FIELD} value={extra} placeholder="extra args (e.g. --threads 6)" onChange={(e) => setExtra(e.target.value)} />
      <input className={FIELD} value={binary} placeholder="llama-server path (blank = use PATH)" onChange={(e) => setBinary(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <button className="hmi-key hmi-key-go px-3 py-2.5 text-[13px] font-semibold rounded-md disabled:opacity-45" onClick={onStart} disabled={!gguf}>Start</button>
        <button className="hmi-key px-3 py-2.5 text-[13px] font-semibold rounded-md" onClick={onStop}>Stop</button>
      </div>
      <div className="flex items-center gap-1.5 pt-0.5">
        <span className={'hmi-lamp ' + lamp} />
        <span className="hmi-engrave text-[11px] font-semibold">{status.state}</span>
        {status.error && <span className="hmi-engrave text-[10px] opacity-60">· {status.error}</span>}
      </div>
      {noBinary && (
        <div className="hmi-engrave text-[10px] opacity-60">
          No llama-server found — see <strong>LLAMA_SETUP.md</strong> in the repo to install it.
        </div>
      )}
      <div ref={logRef} className="hmi-lcd h-[110px] overflow-y-auto rounded p-2 text-[10px] whitespace-pre-wrap">
        {(status.log || []).join('\n')}
      </div>
    </div>
  );
}
