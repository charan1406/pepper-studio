import React, { useState, useEffect, useRef } from 'react';
import { getVoiceStatus, voiceTalk, voiceClear, getBridgeUrl, getSearxngUrl } from '../lib/bridge';
import { Button } from '../design';

export default function VoicePanel() {
  const [secs, setSecs] = useState('5');
  const [status, setStatus] = useState({ state: 'idle', transcript: [], error: '' });
  const logRef = useRef(null);

  const refresh = () => getVoiceStatus().then((r) => { if (r?.data) setStatus(r.data); }).catch(() => {});

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [status.transcript]);

  const onTalk = async () => {
    const r = await voiceTalk({ bridge_url: getBridgeUrl(), searxng_url: getSearxngUrl(), seconds: Number(secs) || 5 });
    if (r?.data) setStatus(r.data);
  };

  const onClear = async () => { const r = await voiceClear(); if (r?.data) setStatus(r.data); };

  const busy = status.state === 'busy';
  const stateTone = busy ? 'text-warn' : 'text-ok';

  return (
    <div className="mt-2.5">
      <div className="flex gap-1.5">
        <Button variant="primary" className="flex-1" onClick={onTalk} disabled={busy}>
          {busy ? '● listening…' : '🎤 Talk to Pepper'}
        </Button>
        <input value={secs} title="record seconds" onChange={(e) => setSecs(e.target.value)}
          className="w-[54px] text-center rounded-md bg-surface-1 border border-border text-sm text-text
                     focus:outline-none focus:border-accent/60 focus:ring-[3px] focus:ring-accent-soft" />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className={'text-[10px] font-semibold ' + stateTone}>● {status.state}</span>
        {status.error && <span className="text-[10px] text-dim">{status.error}</span>}
        <Button variant="ghost" className="ml-auto px-2 py-1 text-[11px]" onClick={onClear}>Clear</Button>
      </div>
      <div ref={logRef} className="mt-2 max-h-[160px] overflow-y-auto bg-bg border border-border rounded-md p-1.5 text-[11px]">
        {(status.transcript || []).length === 0 && (
          <div className="text-[10px] text-dim">Press Talk and speak. Replies appear here.</div>
        )}
        {(status.transcript || []).map((m, i) => (
          <div key={i} className={'my-0.5 ' + (m.role === 'pepper' ? 'text-ok' : 'text-accent')}>
            <strong>{m.role === 'pepper' ? 'Pepper' : 'You'}:</strong> {m.text}
          </div>
        ))}
      </div>
      <div className="text-[10px] text-dim mt-1.5">Records from the connected bridge, transcribes, and Pepper replies aloud.</div>
    </div>
  );
}
