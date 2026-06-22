import React, { useState } from 'react';
import { Button } from '../design';
import { usePepperStore } from '../hooks/usePepperState';

const SEEN_KEY = 'pepper_onboarded';

function seen() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}

export default function Onboarding() {
  const [show, setShow] = useState(() => !seen());
  const openAiPanel = usePepperStore((s) => s.openAiPanel);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  };
  const setupAi = (source = null) => { openAiPanel(source); dismiss(); };

  return (
    <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4">
      <div className="w-[440px] max-w-full bg-surface-1 border border-border-strong rounded-lg shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-text">Welcome to Pepper Studio</h2>
          <p className="text-sm text-muted mt-1.5 leading-relaxed">
            A sandbox for the Pepper robot — drive it by hand, test against the HTTP bridge,
            and give it an optional AI brain. It works fully without AI, but setting one up
            unlocks conversation.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-border">
          <div className="text-[10px] font-semibold text-dim uppercase tracking-[1.5px] mb-2">Set up the AI brain</div>
          <Button className="w-full" onClick={() => setupAi(null)}>Set up AI →</Button>
          <div className="flex items-center justify-center gap-3 mt-2.5 text-xs">
            <button className="text-muted hover:text-text" onClick={() => setupAi('cloud')}>Cloud key</button>
            <span className="text-dim">·</span>
            <button className="text-muted hover:text-text" onClick={() => setupAi('local')}>Local server</button>
            <span className="text-dim">·</span>
            <button className="text-muted hover:text-text" onClick={() => setupAi('gguf')}>Local GGUF</button>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-dim">Switch Sim/Real up top · ⌘K for quick actions</span>
          <Button variant="ghost" onClick={dismiss}>Skip for now</Button>
        </div>
      </div>
    </div>
  );
}
