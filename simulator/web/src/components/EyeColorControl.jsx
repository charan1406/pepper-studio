import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';

const PRESETS = ['#ffffff', '#ff3b30', '#ff9500', '#ffe600', '#34d860', '#00d6c8', '#0a84ff', '#a855f7', '#ff2d92'];
const POP_W = 224;
const POP_H = 272;

export default function EyeColorControl({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popRef = useRef(null);

  // Anchor the popover to the right of the swatch, clamped into the viewport.
  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(r.right + 10, window.innerWidth - POP_W - 8);
    const top = Math.max(8, Math.min(r.top, window.innerHeight - POP_H - 8));
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true); // capture: catches the rail's own scroll
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen((o) => !o)} aria-label="Eye color"
        className="flex items-center gap-3 group">
        <span className="w-11 h-9 rounded-md border border-white/15"
          style={{ background: value, boxShadow: `0 0 9px ${value}99` }} />
        <span className="hmi-engrave text-sm font-mono group-hover:opacity-80">{value}</span>
      </button>

      {open && createPortal(
        <div ref={popRef} className="fixed z-[300] p-3 rounded-lg bg-surface-1 border border-white/12 shadow-2xl"
          style={{ top: pos.top, left: pos.left, width: POP_W }}>
          <HexColorPicker color={value} onChange={onChange} />
          <div className="grid grid-cols-9 gap-1.5 mt-3">
            {PRESETS.map((c) => (
              <button key={c} onClick={() => onChange(c)} aria-label={c}
                className="aspect-square rounded border border-white/15" style={{ background: c }} />
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
