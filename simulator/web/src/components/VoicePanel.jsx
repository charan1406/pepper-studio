import React, { useState, useEffect, useRef } from 'react';
import { getVoiceStatus, voiceTalk, voiceClear, getBridgeUrl, getSearxngUrl } from '../lib/bridge';

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

  return (
    <div>
      <div className="flex gap-2">
        <button className="hmi-key hmi-key-go flex-1 px-3 py-2.5 text-[13px] font-semibold rounded-md disabled:opacity-45"
          onClick={onTalk} disabled={busy}>
          {busy ? '● listening…' : '🎤 Talk to Pepper'}
        </button>
        <input value={secs} title="record seconds" onChange={(e) => setSecs(e.target.value)}
          className="hmi-field w-[54px] text-center text-sm" />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={'hmi-lamp ' + (busy ? 'hmi-lamp-on' : 'hmi-lamp-off')} />
        <span className="hmi-engrave text-[10px] font-semibold">{status.state}</span>
        {status.error && <span className="hmi-engrave text-[10px] opacity-60">{status.error}</span>}
        <button className="hmi-key ml-auto px-2.5 py-1 text-[11px] font-semibold rounded" onClick={onClear}>Clear</button>
      </div>
      <div ref={logRef} className="hmi-lcd mt-2 max-h-[150px] overflow-y-auto rounded p-2 text-[11px]">
        {(status.transcript || []).length === 0 && (
          <div className="opacity-50">Press Talk and speak. Replies appear here.</div>
        )}
        {(status.transcript || []).map((m, i) => (
          <div key={i} className="my-0.5">
            <strong>{m.role === 'pepper' ? 'Pepper' : 'You'}:</strong> {m.text}
          </div>
        ))}
      </div>
    </div>
  );
}
