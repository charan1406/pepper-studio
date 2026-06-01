import React, { useState } from 'react';
import { getAiConfig, setAiConfig, testAiConfig } from '../lib/bridge';

const S = {
  btn: { padding: '4px 8px', background: '#3a3a3c', border: '1px solid #4a4a4c', borderRadius: '6px', color: '#e5e5e5', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
  primary: { padding: '8px 12px', background: '#8aba8a', border: 'none', borderRadius: '6px', color: '#1c1c1e', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  input: { width: '100%', padding: '8px 10px', background: '#1c1c1e', border: '1px solid #3a3a3c', borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', outline: 'none', fontFamily: 'inherit', marginBottom: '6px' },
  tab: (on) => ({ flex: 1, padding: '6px', background: on ? '#3a3a3c' : 'transparent', border: '1px solid #3a3a3c', borderRadius: '6px', color: on ? '#e5e5e5' : '#999', fontSize: '11px', cursor: 'pointer' }),
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' },
  note: { fontSize: '10px', color: '#666', marginTop: '6px' },
};

export default function AISettings() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState({ base_url: '', model: 'local', timeout: 60, enabled: false, key_set: false });
  const [source, setSource] = useState('cloud');
  const [keyDraft, setKeyDraft] = useState('');
  const [status, setStatus] = useState('');

  const refresh = () =>
    getAiConfig().then((r) => { if (r?.data) setCfg((prev) => ({ ...prev, ...r.data })); }).catch(() => {});

  const onToggle = () => { const next = !open; setOpen(next); if (next) refresh(); };

  const buildBody = () => {
    const body = { base_url: cfg.base_url, model: cfg.model, timeout: cfg.timeout };
    if (keyDraft) body.api_key = keyDraft;
    return body;
  };

  const onSave = async () => {
    try {
      const r = await setAiConfig(buildBody());
      if (r?.data) setCfg((prev) => ({ ...prev, ...r.data }));
      setKeyDraft('');
      setStatus(r?.data?.enabled ? 'Saved — AI enabled' : 'Saved — AI disabled');
    } catch {
      setStatus('Save failed — bridge unreachable');
    }
  };

  const onTest = async () => {
    setStatus('Testing…');
    try {
      const r = await testAiConfig(buildBody());
      setStatus(r?.success ? `OK (${Math.round(r?.data?.tok_per_sec || 0)} tok/s)` : `Failed: ${r?.error || 'error'}`);
    } catch {
      setStatus('Test failed — bridge unreachable');
    }
  };

  const onReset = () => { setCfg({ base_url: '', model: 'local', timeout: 60, enabled: false, key_set: false }); setKeyDraft(''); };

  return (
    <div style={{ marginTop: '8px' }}>
      <button style={S.btn} onClick={onToggle}>AI</button>
      {open && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ ...S.grid2, marginBottom: '8px' }}>
            <button style={S.tab(source === 'cloud')} onClick={() => setSource('cloud')}>Cloud</button>
            <button style={S.tab(source === 'local')} onClick={() => setSource('local')}>Local server</button>
          </div>
          <input style={S.input} value={cfg.base_url ?? ''} placeholder="base_url (e.g. http://localhost:8090/v1)"
            onChange={(e) => setCfg({ ...cfg, base_url: e.target.value })} />
          <input style={S.input} value={cfg.model ?? ''} placeholder="model"
            onChange={(e) => setCfg({ ...cfg, model: e.target.value })} />
          {source === 'cloud' && (
            <input style={S.input} type="password" value={keyDraft}
              placeholder={cfg.key_set ? 'key stored •••• (type to replace)' : 'api key'}
              onChange={(e) => setKeyDraft(e.target.value)} />
          )}
          <div style={S.grid2}>
            <button style={S.primary} onClick={onSave}>Save</button>
            <button style={S.btn} onClick={onTest}>Test</button>
          </div>
          <div style={{ ...S.grid2, marginTop: '6px' }}>
            <button style={S.btn} onClick={onReset}>Reset</button>
            <div style={{ fontSize: '10px', color: cfg.enabled ? '#8aba8a' : '#666', alignSelf: 'center' }}>
              {cfg.enabled ? '● enabled' : '○ disabled'}
            </div>
          </div>
          {status && <div style={S.note}>{status}</div>}
        </div>
      )}
    </div>
  );
}
