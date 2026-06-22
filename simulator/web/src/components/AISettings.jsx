import React, { useState, useEffect } from 'react';
import { getAiConfig, setAiConfig, testAiConfig, getProvisionStatus } from '../lib/bridge';
import { Button, Input } from '../design';
import { usePepperStore } from '../hooks/usePepperState';
import LocalRunnerPanel from './LocalRunnerPanel';
import ProvisionPanel from './ProvisionPanel';

function SourceTab({ on, children, ...props }) {
  return (
    <button
      className={'flex-1 px-2 py-2 rounded-md text-[11px] border transition-colors '
        + (on ? 'bg-surface-2 border-border-strong text-text' : 'bg-transparent border-border text-muted hover:text-text')}
      {...props}
    >{children}</button>
  );
}

export default function AISettings() {
  const open = usePepperStore((s) => s.aiPanelOpen);
  const setOpen = usePepperStore((s) => s.setAiPanelOpen);
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

  // Refresh whenever the panel opens (via the AI button or an onboarding
  // deep-link); apply a preselected source from onboarding, then clear it.
  useEffect(() => {
    if (!open) return;
    refresh();
    if (aiInitialSource) { setSource(aiInitialSource); clearAiInitialSource(); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onToggle = () => setOpen(!open);

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
    <div className="mt-2">
      <Button variant="secondary" className="px-2 py-1 text-[11px]" onClick={onToggle}>AI</Button>
      {open && (
        <div className="mt-3">
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
              <Input className="w-full mb-2" value={cfg.base_url ?? ''} placeholder="base_url (e.g. http://localhost:8090/v1)"
                onChange={(e) => setCfg({ ...cfg, base_url: e.target.value })} />
              <Input className="w-full mb-2" value={cfg.model ?? ''} placeholder="model"
                onChange={(e) => setCfg({ ...cfg, model: e.target.value })} />
              {source === 'cloud' && (
                <Input className="w-full mb-2" type="password" value={keyDraft}
                  placeholder={cfg.key_set ? 'key stored •••• (type to replace)' : 'api key'}
                  onChange={(e) => setKeyDraft(e.target.value)} />
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={onSave}>Save</Button>
                <Button variant="secondary" onClick={onTest}>Test</Button>
              </div>
              <div className="flex items-center justify-between mt-2.5">
                <Button variant="ghost" onClick={onReset}>Reset</Button>
                <div className={'text-[11px] ' + (cfg.enabled ? 'text-ok' : 'text-dim')}>
                  {cfg.enabled ? '● enabled' : '○ disabled'}
                </div>
              </div>
              {status && <div className="text-[11px] text-dim mt-2.5">{status}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
