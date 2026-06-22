import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { setPosture, stopMove, setHead, stopSpeak, POSTURES } from '../lib/bridge';
import { usePepperStore } from '../hooks/usePepperState';

// Flat list of parameterless quick actions. Each maps to an existing bridge
// call or store action — the palette is a keyboard shortcut to the same wiring
// the panels use, never a second source of truth.
function buildCommands() {
  const { setMode } = usePepperStore.getState();
  return [
    ...POSTURES.map((p) => ({ id: `posture:${p}`, label: `Posture: ${p}`, group: 'Posture', run: () => setPosture(p, 0.5) })),
    { id: 'move:stop', label: 'Stop movement', group: 'Movement', run: () => stopMove() },
    { id: 'head:center', label: 'Center head', group: 'Head', run: () => setHead(0, 0) },
    { id: 'speak:stop', label: 'Stop speaking', group: 'Speech', run: () => stopSpeak() },
    { id: 'mode:sim', label: 'Switch to Simulator', group: 'Bridge', run: () => setMode('sim') },
    { id: 'mode:real', label: 'Switch to Real Robot', group: 'Bridge', run: () => setMode('real') },
  ];
}

export default function CommandPalette() {
  const open = usePepperStore((s) => s.paletteOpen);
  const setOpen = usePepperStore((s) => s.setPaletteOpen);
  const togglePalette = usePepperStore((s) => s.togglePalette);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  // Global ⌘K / Ctrl+K toggles the palette.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePalette]);

  const commands = useMemo(buildCommands, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands;
  }, [commands, query]);

  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => { if (open) setQuery(''); }, [open]);

  const run = (cmd) => { if (cmd) { cmd.run(); setOpen(false); } };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[active]); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[200]" />
        <Dialog.Content
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
          aria-label="Command palette"
          className="fixed left-1/2 top-[20%] -translate-x-1/2 w-[min(560px,92vw)] z-[201]
                     bg-overlay border border-border-strong rounded-lg shadow-2xl overflow-hidden"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search and run a Pepper quick action.</Dialog.Description>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command…"
            className="w-full px-4 py-3 bg-transparent text-text text-sm outline-none border-b border-border placeholder:text-dim"
          />
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-dim">No matching commands</li>
            )}
            {filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(c)}
                  className={'w-full flex items-center justify-between px-4 py-2 text-sm text-left '
                    + (i === active ? 'bg-accent-soft text-text' : 'text-muted hover:bg-surface-2')}
                >
                  <span>{c.label}</span>
                  <span className="text-[10px] text-dim uppercase tracking-wider">{c.group}</span>
                </button>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
