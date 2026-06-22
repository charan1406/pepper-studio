import React, { useState, useEffect } from 'react';
import { getAiConfig, setAiConfig, testAiConfig, getProvisionStatus } from '../lib/bridge';
import { usePepperStore } from '../hooks/usePepperState';
import LocalRunnerPanel from './LocalRunnerPanel';
import ProvisionPanel from './ProvisionPanel';

const KEY = 'hmi-key px-3 py-2.5 text-[13px] font-semibold rounded-md';
const GO = 'hmi-key hmi-key-go px-3 py-2.5 text-[13px] font-semibold rounded-md';
const FIELD = 'hmi-field w-full px-3 py-2.5 text-sm mb-2';

function SourceTab({ on, children, ...props }) {
  return (
    <button className={'flex-1 px-2 py-2 rounded-md text-[11px] font-semibold ' + (on ? 'hmi-key hmi-key-go' : 'hmi-key')} {...props}>
      {children}
    </button>
  );
}

export default function AISettings() {
  const settingsOpen = usePepperStore((s) => s.settingsOpen);
  const aiInitialSource = usePepperStore((s) => s.aiInitialSource);
  const clearAiInitialSource = usePepperStore((s) => s.clearAiInitialSource);
  const [cfg, setCfg] = useState({ base_url: '', model: 'local', timeout: 60, enabled: false, key_set: false });
  const [source, setSource] = useState('cloud');
  const [keyDraft, setKeyDraft] = useState('');
  const [status, setStatus] = useState('');
  const [bundle, setBundle] = useState('lean');

  const refresh = () => {
    getAiConfig().then((r) => { if (r?.data) setCfg((prev) => ({ ...prev, ...r.data })); }).catch(() => {});
    getProvisionStatus().then((r) => {
      if (!r?.data) return;
      setBundle(r.data.bundle || 'lean');
      // First run of the "full" build with nothing downloaded -> land on Auto setup.
      if (r.data.bundle === 'full' && !r.data.provisioned) setSource('auto');
    }).catch(() => {});
  };

  // Load on mount and whenever the setup drawer opens; apply an onboarding
  // deep-link's preselected source, then clear it.
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (settingsOpen) refresh(); }, [settingsOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (aiInitialSource) { setSource(aiInitialSource); clearAiInitialSource(); }
  }, [aiInitialSource]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div>
      <div className="flex gap-2 mb-3">
        {bundle === 'full' && <SourceTab on={source === 'auto'} onClick={() => setSource('auto')}>Auto</SourceTab>}
        <SourceTab on={source === 'cloud'} onClick={() => setSource('cloud')}>Cloud</SourceTab>
        <SourceTab on={source === 'local'} onClick={() => setSource('local')}>Local server</SourceTab>
        <SourceTab on={source === 'gguf'} onClick={() => setSource('gguf')}>Local GGUF</SourceTab>
      </div>
      {source === 'auto' && <ProvisionPanel />}
      {source === 'gguf' && <LocalRunnerPanel />}
      {source !== 'gguf' && source !== 'auto' && (
        <>
          <input className={FIELD} value={cfg.base_url ?? ''} placeholder="base_url (e.g. http://localhost:8090/v1)"
            onChange={(e) => setCfg({ ...cfg, base_url: e.target.value })} />
          <input className={FIELD} value={cfg.model ?? ''} placeholder="model"
            onChange={(e) => setCfg({ ...cfg, model: e.target.value })} />
          {source === 'cloud' && (
            <input className={FIELD} type="password" value={keyDraft}
              placeholder={cfg.key_set ? 'key stored •••• (type to replace)' : 'api key'}
              onChange={(e) => setKeyDraft(e.target.value)} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className={GO} onClick={onSave}>Save</button>
            <button className={KEY} onClick={onTest}>Test</button>
          </div>
          <div className="flex items-center justify-between mt-3">
            <button className={KEY + ' opacity-80'} onClick={onReset}>Reset</button>
            <div className="flex items-center gap-1.5">
              <span className={'hmi-lamp ' + (cfg.enabled ? 'hmi-lamp-on' : 'hmi-lamp-off')} />
              <span className="hmi-engrave text-[11px] font-semibold">{cfg.enabled ? 'ENABLED' : 'DISABLED'}</span>
            </div>
          </div>
          {status && <div className="hmi-engrave text-[11px] opacity-70 mt-2.5">{status}</div>}
        </>
      )}
    </div>
  );
}
