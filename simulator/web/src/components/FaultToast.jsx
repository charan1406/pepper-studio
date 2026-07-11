import React, { useState, useEffect, useRef } from 'react';

// Surfaces failed bridge commands (dispatched as 'bridge-fault' by lib/bridge).
// Without this, a dead bridge or a 400 made control clicks fail silently.
const SHOW_MS = 5000;

export default function FaultToast() {
  const [fault, setFault] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    const onFault = (e) => {
      setFault(e.detail);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFault(null), SHOW_MS);
    };
    window.addEventListener('bridge-fault', onFault);
    return () => {
      window.removeEventListener('bridge-fault', onFault);
      clearTimeout(timer.current);
    };
  }, []);

  if (!fault) return null;

  return (
    <div
      role="alert"
      onClick={() => setFault(null)}
      className="absolute bottom-5 left-1/2 -translate-x-1/2 max-w-[560px] z-[200] cursor-pointer
                 hmi-plate border border-danger/40 rounded-lg px-4 py-2.5 flex items-center gap-2.5 shadow-2xl"
    >
      <span className="hmi-lamp hmi-lamp-red shrink-0" />
      <span className="hmi-engrave text-[12px] font-semibold uppercase tracking-wider shrink-0">Fault</span>
      <span className="text-[12px] text-text/90 font-mono leading-snug">{fault.message}</span>
    </div>
  );
}
