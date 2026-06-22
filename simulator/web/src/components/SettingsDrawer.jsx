import React, { useState, useEffect } from 'react';
import { getBridgeUrl, setBridgeUrl } from '../lib/bridge';
import { usePepperStore } from '../hooks/usePepperState';
import AISettings from './AISettings';
import RobotConnection from './RobotConnection';
import ServicesPanel from './ServicesPanel';

function Group({ title, hint, children }) {
  return (
    <section className="px-6 py-5 border-b border-white/10">
      <h3 className="hmi-engrave text-[12px] font-bold uppercase tracking-[2px]">{title}</h3>
      {hint && <p className="hmi-engrave text-[11px] opacity-60 mt-1 mb-3.5 leading-relaxed">{hint}</p>}
      <div className={hint ? '' : 'mt-3.5'}>{children}</div>
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
        className={'hmi-panel fixed top-0 right-0 h-full w-[392px] max-w-full border-l border-white/12 z-[211] '
          + 'flex flex-col transition-transform duration-200 ' + (open ? 'translate-x-0' : 'translate-x-full')}
      >
        <header className="hmi-plate flex items-center justify-between px-6 h-14 border-b border-white/10 shrink-0">
          <span className="hmi-engrave text-[13px] font-bold uppercase tracking-[2px]">Setup</span>
          <button onClick={() => setOpen(false)} aria-label="Close setup"
            className="hmi-key w-8 h-8 flex items-center justify-center rounded-md">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Group title="AI brain" hint="Cloud key, a local server, or a GGUF the app launches for you.">
            <AISettings />
          </Group>

          <Group title="Bridge & robot" hint="Where control commands go. Connect a real Pepper to point them at the robot.">
            <input className="hmi-field w-full px-3 py-2.5 text-sm" value={urlDraft} placeholder="http://localhost:5001"
              onChange={(e) => setUrlDraft(e.target.value)} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button aria-label="Save bridge URL" className="hmi-key hmi-key-go px-3 py-2.5 text-[13px] font-semibold rounded-md" onClick={() => setBridgeUrl(urlDraft)}>Save</button>
              <button aria-label="Reset bridge URL" className="hmi-key px-3 py-2.5 text-[13px] font-semibold rounded-md" onClick={() => { setBridgeUrl(''); setUrlDraft(getBridgeUrl()); }}>Reset</button>
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
