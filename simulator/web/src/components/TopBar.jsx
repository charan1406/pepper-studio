import React from 'react';
import { Command, Settings } from 'lucide-react';
import { SegmentedToggle } from '../design';
import { usePepperStore } from '../hooks/usePepperState';

export default function TopBar() {
  const connected = usePepperStore((s) => s.connected);
  const battery = usePepperStore((s) => s.battery);
  const posture = usePepperStore((s) => s.posture);
  const isMoving = usePepperStore((s) => s.isMoving);
  const mode = usePepperStore((s) => s.mode);
  const setMode = usePepperStore((s) => s.setMode);
  const togglePalette = usePepperStore((s) => s.togglePalette);
  const toggleSettings = usePepperStore((s) => s.toggleSettings);

  return (
    <header className="hmi-plate flex items-center justify-between gap-4 px-5 h-14 border-b border-[#9a9da0] shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="hmi-engrave text-[15px] font-bold uppercase tracking-[2.5px]">Pepper Studio</span>
        <span className="hmi-engrave text-[10px] uppercase tracking-[2px] opacity-60 hidden sm:inline">Sandbox</span>
      </div>

      <SegmentedToggle
        ariaLabel="Bridge target"
        value={mode}
        onValueChange={setMode}
        options={[{ value: 'sim', label: 'Simulator' }, { value: 'real', label: 'Real Robot' }]}
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={'hmi-lamp ' + (connected ? 'hmi-lamp-on' : 'hmi-lamp-red')} />
          <span className="hmi-engrave text-[10px] font-bold tracking-wider">{connected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
        <div className="hmi-lcd px-2 py-1 flex items-baseline gap-1">
          <span className="lcd-7seg text-[13px]">{battery}</span>
          <span className="text-[10px] opacity-70">%</span>
        </div>
        <span className="hmi-engrave text-[11px] font-semibold">{posture}{isMoving ? ' ▸' : ''}</span>
        <button onClick={togglePalette} aria-label="Open command palette"
          className="hmi-key h-8 px-2.5 flex items-center gap-1 rounded-md text-[12px] font-semibold">
          <Command size={13} />K
        </button>
        <button onClick={toggleSettings} aria-label="Open setup"
          className="hmi-key w-8 h-8 flex items-center justify-center rounded-md">
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}
