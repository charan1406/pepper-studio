import React, { useState, useEffect } from 'react';
import { getServicesStatus, startSearxng, stopSearxng, getRunnerStatus, getSearxngUrl, setSearxngUrl } from '../lib/bridge';
import { Button } from '../design';

function ServiceRow({ on, name, state, action }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className={'w-2 h-2 rounded-full inline-block ' + (on ? 'bg-ok' : 'bg-dim')} />
      <span className="text-sm text-text min-w-[64px]">{name}</span>
      <span className={'text-[11px] min-w-[64px] ' + (on ? 'text-ok' : 'text-muted')}>{state}</span>
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
          ? <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={onStop}>Stop</Button>
          : <Button className="px-2.5 py-1 text-xs" onClick={onStart}>Start</Button>} />
      <ServiceRow on={llamaOn} name="llama" state={runner.state}
        action={<span className="text-[10px] text-dim">manage in AI ▸</span>} />
      {searxng.error && <div className="text-[10px] text-dim mt-1">{searxng.error}</div>}
      <input value={url} placeholder="SearXNG URL (blank = web search off)"
        onChange={(e) => { setUrl(e.target.value); setSearxngUrl(e.target.value); }}
        className="w-full mt-1.5 rounded-md bg-surface-1 border border-border px-2 py-1.5 text-[11px] text-text
                   placeholder:text-dim focus:outline-none focus:border-accent/60 focus:ring-[3px] focus:ring-accent-soft" />
      <div className="text-[10px] text-dim mt-1">URL the voice loop uses for web search. Saved locally.</div>
    </div>
  );
}
