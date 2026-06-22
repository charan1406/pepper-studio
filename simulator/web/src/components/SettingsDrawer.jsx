import React, { useState, useEffect } from 'react';
import { getBridgeUrl, setBridgeUrl } from '../lib/bridge';
import { usePepperStore } from '../hooks/usePepperState';
import { Button, Input } from '../design';
import AISettings from './AISettings';
import RobotConnection from './RobotConnection';
import ServicesPanel from './ServicesPanel';

function Group({ title, hint, children }) {
  return (
    <section className="px-5 py-4 border-b border-border">
      <h3 className="text-[11px] font-semibold text-text tracking-wide">{title}</h3>
      {hint && <p className="text-[11px] text-dim mt-0.5 mb-2.5 leading-relaxed">{hint}</p>}
      <div className={hint ? '' : 'mt-2.5'}>{children}</div>
    </section>
  );
}

export default function SettingsDrawer() {
  const open = usePepperStore((s) => s.settingsOpen);
  const setOpen = usePepperStore((s) => s.setSettingsOpen);
  const [urlDraft, setUrlDraft] = useState(getBridgeUrl());

  useEffect(() => {
    if (!open) return;
    setUrlDraft(getBridgeUrl());
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className={'fixed inset-0 bg-black/50 z-[210] transition-opacity '
          + (open ? 'opacity-100' : 'opacity-0 pointer-events-none')}
      />
      <aside
        aria-label="Setup"
        className={'fixed top-0 right-0 h-full w-[360px] max-w-full bg-surface-1 border-l border-border-strong z-[211] '
          + 'flex flex-col transition-transform duration-200 ' + (open ? 'translate-x-0' : 'translate-x-full')}
      >
        <header className="flex items-center justify-between px-5 h-12 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-text">Setup</span>
          <button onClick={() => setOpen(false)} aria-label="Close setup"
            className="text-muted hover:text-text text-base">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Group title="AI brain" hint="Cloud key, a local server, or a GGUF the app launches for you.">
            <AISettings />
          </Group>

          <Group title="Bridge & robot" hint="Where control commands go. Connect a real Pepper to point them at the robot.">
            <Input className="w-full" value={urlDraft} placeholder="http://localhost:5001"
              onChange={(e) => setUrlDraft(e.target.value)} />
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              <Button onClick={() => setBridgeUrl(urlDraft)}>Save</Button>
              <Button variant="secondary" onClick={() => { setBridgeUrl(''); setUrlDraft(getBridgeUrl()); }}>Reset</Button>
            </div>
            <RobotConnection />
          </Group>

          <Group title="Services" hint="Docker-managed SearXNG for the voice loop's web search.">
            <ServicesPanel />
          </Group>
        </div>
      </aside>
    </>
  );
}
