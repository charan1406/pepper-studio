import React, { useState, useEffect, useRef } from 'react';
import { getVoiceStatus, voiceTalk, voiceClear, getBridgeUrl } from '../lib/bridge';

const S = {
  input: { width: '100%', padding: '8px 10px', background: '#1c1c1e', border: '1px solid #3a3a3c', borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', outline: 'none', fontFamily: 'inherit', marginBottom: '6px', boxSizing: 'border-box' },
  btn: { padding: '8px 10px', background: '#3a3a3c', border: '1px solid #4a4a4c', borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' },
  talk: (busy) => ({ flex: 1, padding: '10px 12px', background: busy ? '#4a4a4c' : '#8aba8a', border: 'none', borderRadius: '6px', color: busy ? '#aaa' : '#1c1c1e', fontSize: '13px', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }),
  row: { display: 'flex', gap: '6px' },
  badge: (s) => ({ fontSize: '10px', fontWeight: 600, color: s === 'busy' ? '#d4a847' : '#8aba8a' }),
  note: { fontSize: '10px', color: '#666', marginTop: '6px' },
  log: { marginTop: '8px', maxHeight: '160px', overflowY: 'auto', background: '#0e0e10', border: '1px solid #3a3a3c', borderRadius: '6px', padding: '6px', fontSize: '11px', fontFamily: 'inherit' },
  you: { color: '#9ab', margin: '2px 0' },
  pepper: { color: '#bda', margin: '2px 0' },
};

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
    const r = await voiceTalk({ bridge_url: getBridgeUrl(), seconds: Number(secs) || 5 });
    if (r?.data) setStatus(r.data);
  };

  const onClear = async () => { const r = await voiceClear(); if (r?.data) setStatus(r.data); };

  const busy = status.state === 'busy';

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={S.row}>
        <button style={S.talk(busy)} onClick={onTalk} disabled={busy}>
          {busy ? '● listening…' : '🎤 Talk to Pepper'}
        </button>
        <input style={{ ...S.input, width: '54px', marginBottom: 0, textAlign: 'center' }}
          value={secs} title="record seconds" onChange={(e) => setSecs(e.target.value)} />
      </div>
      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={S.badge(status.state)}>● {status.state}</span>
        {status.error && <span style={S.note}>{status.error}</span>}
        <button style={{ ...S.btn, marginLeft: 'auto', padding: '4px 8px' }} onClick={onClear}>Clear</button>
      </div>
      <div ref={logRef} style={S.log}>
        {(status.transcript || []).length === 0 && <div style={S.note}>Press Talk and speak. Replies appear here.</div>}
        {(status.transcript || []).map((m, i) => (
          <div key={i} style={m.role === 'pepper' ? S.pepper : S.you}>
            <strong>{m.role === 'pepper' ? 'Pepper' : 'You'}:</strong> {m.text}
          </div>
        ))}
      </div>
      <div style={S.note}>Records from the connected bridge, transcribes, and Pepper replies aloud.</div>
    </div>
  );
}
