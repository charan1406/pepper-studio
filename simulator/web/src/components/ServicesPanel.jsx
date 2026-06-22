import React, { useState, useEffect } from 'react';
import { getServicesStatus, startSearxng, stopSearxng, getRunnerStatus, getSearxngUrl, setSearxngUrl } from '../lib/bridge';

function ServiceRow({ on, name, state, action }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className={'hmi-lamp ' + (on ? 'hmi-lamp-on' : 'hmi-lamp-off')} />
      <span className="hmi-engrave text-sm min-w-[64px]">{name}</span>
      <span className="hmi-engrave text-[11px] min-w-[64px] opacity-70">{state}</span>
      <span className="ml-auto">{action}</span>
    </div>
  );
}

export default function ServicesPanel() {
  const [searxng, setSearxng] = useState({ running: false, present: false, error: '' });
  const [runner, setRunner] = useState({ state: 'stopped' });
  const [url, setUrl] = useState(getSearxngUrl());

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
    <div className="mt-2.5">
      <ServiceRow on={searxng.running} name="SearXNG" state={searxng.running ? 'running' : 'stopped'}
        action={searxng.running
          ? <button className="hmi-key px-2.5 py-1 text-xs font-semibold rounded" onClick={onStop}>Stop</button>
          : <button className="hmi-key hmi-key-go px-2.5 py-1 text-xs font-semibold rounded" onClick={onStart}>Start</button>} />
      <ServiceRow on={llamaOn} name="llama" state={runner.state}
        action={<span className="hmi-engrave text-[10px] opacity-60">manage in AI ▸</span>} />
      {searxng.error && <div className="hmi-engrave text-[10px] opacity-60 mt-1">{searxng.error}</div>}
      <input value={url} placeholder="SearXNG URL (blank = web search off)"
        onChange={(e) => { setUrl(e.target.value); setSearxngUrl(e.target.value); }}
        className="hmi-field w-full mt-2 px-2.5 py-2 text-[11px]" />
      <div className="hmi-engrave text-[10px] opacity-60 mt-1.5">URL the voice loop uses for web search. Saved locally.</div>
    </div>
  );
}
