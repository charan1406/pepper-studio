import React from 'react';
import { SegmentedToggle } from '../design';
import { usePepperStore } from '../hooks/usePepperState';

function Chip({ tone = 'muted', children }) {
  const tones = {
    ok: 'text-ok bg-ok/15',
    warn: 'text-warn bg-warn/15',
    danger: 'text-danger bg-danger/15',
    muted: 'text-muted bg-surface-2',
  };
  return (
    <span className={'text-[11px] px-2.5 py-1 rounded-md whitespace-nowrap ' + (tones[tone] || tones.muted)}>
      {children}
    </span>
  );
}

export default function TopBar() {
  const connected = usePepperStore((s) => s.connected);
  const battery = usePepperStore((s) => s.battery);
  const posture = usePepperStore((s) => s.posture);
  const isMoving = usePepperStore((s) => s.isMoving);
  const mode = usePepperStore((s) => s.mode);
  const setMode = usePepperStore((s) => s.setMode);
  const togglePalette = usePepperStore((s) => s.togglePalette);
  const toggleSettings = usePepperStore((s) => s.toggleSettings);

  const batteryTone = battery > 50 ? 'ok' : battery > 20 ? 'warn' : 'danger';

  return (
    <header className="flex items-center justify-between gap-4 px-4 h-12 bg-surface-1 border-b border-border shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-semibold text-text tracking-tight">Pepper Studio</span>
        <span className="text-[10px] text-dim uppercase tracking-[2px] hidden sm:inline">Sandbox</span>
      </div>

      <SegmentedToggle
        ariaLabel="Bridge target"
        value={mode}
        onValueChange={setMode}
        options={[{ value: 'sim', label: 'Simulator' }, { value: 'real', label: 'Real Robot' }]}
      />

      <div className="flex items-center gap-2">
        <Chip tone={connected ? 'ok' : 'danger'}>{connected ? '● Connected' : '○ Offline'}</Chip>
        <Chip tone={batteryTone}>{battery}%</Chip>
        <Chip tone="muted">{posture}{isMoving ? ' →' : ''}</Chip>
        <button
          onClick={togglePalette}
          aria-label="Open command palette"
          className="text-[11px] px-2 py-1 rounded-md text-muted bg-surface-2 border border-border
                     hover:border-border-strong hover:text-text transition-colors"
        >⌘K</button>
        <button
          onClick={toggleSettings}
          aria-label="Open setup"
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted bg-surface-2 border border-border
                     hover:border-border-strong hover:text-text transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
