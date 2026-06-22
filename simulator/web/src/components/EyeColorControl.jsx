import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

const PRESETS = ['#ffffff', '#ff3b30', '#ff9500', '#ffe600', '#34d860', '#00d6c8', '#0a84ff', '#a855f7', '#ff2d92'];

export default function EyeColorControl({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Eye color"
        className="flex items-center gap-3 group">
        <span className="w-11 h-9 rounded-md border border-white/15"
          style={{ background: value, boxShadow: `0 0 9px ${value}99` }} />
        <span className="hmi-engrave text-sm font-mono group-hover:opacity-80">{value}</span>
      </button>

      {open && (
        <div className="eye-pop absolute bottom-full left-0 mb-2 z-[120] p-3 rounded-lg bg-surface-1 border border-white/12 shadow-2xl">
          <HexColorPicker color={value} onChange={onChange} />
          <div className="grid grid-cols-9 gap-1.5 mt-3" style={{ width: 200 }}>
            {PRESETS.map((c) => (
              <button key={c} onClick={() => onChange(c)} aria-label={c}
                className="aspect-square rounded border border-white/15"
                style={{ background: c }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
