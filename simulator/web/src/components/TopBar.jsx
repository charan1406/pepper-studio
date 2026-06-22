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
      </div>
    </header>
  );
}
