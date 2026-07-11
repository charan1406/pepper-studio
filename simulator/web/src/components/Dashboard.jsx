import React, { useState } from 'react';
import { usePepperStore } from '../hooks/usePepperState';
import ApiReference from './ApiReference';

function Label({ children, extra }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="hmi-engrave text-[10px] font-bold uppercase tracking-[2px]">{children}</h3>
      {extra}
    </div>
  );
}

function Lcd({ label, value, unit, big }) {
  return (
    <div className="hmi-lcd rounded px-3 py-2">
      <div className="text-[9px] tracking-[2px] opacity-75 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={'lcd-7seg ' + (big ? 'text-[22px]' : 'text-[15px]')}>{value}</span>
        {unit && <span className="text-[10px] opacity-70">{unit}</span>}
      </div>
    </div>
  );
}

function LampRow({ on, red, label, value }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={'hmi-lamp ' + (on ? 'hmi-lamp-on' : red ? 'hmi-lamp-red' : 'hmi-lamp-off')} />
      <span className="hmi-engrave text-[12px]">{label}</span>
      <span className="ml-auto hmi-engrave text-[12px] font-semibold">{value}</span>
    </div>
  );
}

// Top-down floorplan in metres (room is 8 x 6). Footprints mirror the props
// in Room.jsx — keep the two in sync if the lounge layout changes. Rects are
// [cx, cy, w, h]; circles [cx, cy, r].
const FURNITURE = {
  rects: [
    [2.5, 0.45, 2.2, 0.9],   // sofa
    [5.9, 0.3, 1.6, 0.4],    // media unit
    [0.25, 3.9, 0.4, 1.05],  // kallax shelf
  ],
  circles: [
    [2.5, 1.25, 0.52],       // coffee table
    [0.9, 0.55, 0.18],       // floor lamp
    [7.4, 0.5, 0.22], [0.55, 0.5, 0.18], [7.3, 5.2, 0.22], // plants
  ],
  rug: [2.5, 0.95, 3.2, 2.3],
};

function MiniMap() {
  const x = usePepperStore((s) => s.x);
  const y = usePepperStore((s) => s.y);
  const theta = usePepperStore((s) => s.theta);
  const [rcx, rcy, rw, rh] = FURNITURE.rug;
  const hx = x + Math.cos(theta) * 0.55;
  const hy = y - Math.sin(theta) * 0.55;

  return (
    <div className="hmi-glass w-full h-[120px] rounded overflow-hidden">
      <svg width="100%" height="100%" viewBox="0 0 8 6" preserveAspectRatio="xMidYMid meet">
        <rect x={0.04} y={0.04} width={7.92} height={5.92} fill="none" stroke="#1e3a2a" strokeWidth={0.06} />
        <rect x={rcx - rw / 2} y={rcy - rh / 2} width={rw} height={rh} fill="#13251b" />
        {FURNITURE.rects.map(([cx, cy, w, h], i) => (
          <rect key={i} x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={0.06}
            fill="#274a37" stroke="#356b4e" strokeWidth={0.03} />
        ))}
        {FURNITURE.circles.map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="#274a37" stroke="#356b4e" strokeWidth={0.03} />
        ))}
        {/* Pepper + heading */}
        <line x1={x} y1={y} x2={hx} y2={hy} stroke="#6cf39a" strokeWidth={0.08} strokeLinecap="round" />
        <circle cx={x} cy={y} r={0.22} fill="#34d8c8" stroke="#6cf39a" strokeWidth={0.04} />
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const connected = usePepperStore((s) => s.connected);
  const battery = usePepperStore((s) => s.battery);
  const x = usePepperStore((s) => s.x);
  const y = usePepperStore((s) => s.y);
  const theta = usePepperStore((s) => s.theta);
  const posture = usePepperStore((s) => s.posture);
  const isMoving = usePepperStore((s) => s.isMoving);
  const eyeColor = usePepperStore((s) => s.eyeColor);
  const autonomousLife = usePepperStore((s) => s.autonomousLife);
  const currentAnimation = usePepperStore((s) => s.currentAnimation);
  const uptime = usePepperStore((s) => s.uptime);
  const apiLog = usePepperStore((s) => s.apiLog);

  const [showApiRef, setShowApiRef] = useState(false);

  const clock = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="hmi-panel w-[380px] h-full border-l border-white/10 flex flex-col overflow-hidden">
      <header className="hmi-plate flex items-center gap-2.5 px-5 h-14 border-b border-white/10 shrink-0">
        <span className={'hmi-lamp ' + (connected ? 'hmi-lamp-on' : 'hmi-lamp-red')} />
        <span className="hmi-engrave text-[13px] font-bold uppercase tracking-[2px]">Telemetry</span>
        <span className="ml-auto hmi-engrave text-[10px] font-bold tracking-wider opacity-70">
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>
      </header>

      <div className="flex flex-col flex-1 min-h-0 p-4 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Lcd big label="BATTERY" value={battery} unit="%" />
          <Lcd big label="UPTIME" value={clock(uptime)} />
        </div>

        <div className="hmi-plate rounded-lg px-3.5 py-2.5">
          <Label>Status</Label>
          <LampRow on={connected} red={!connected} label="Link" value={connected ? 'OK' : 'DOWN'} />
          <LampRow on={isMoving} label="Motion" value={isMoving ? 'MOVING' : 'idle'} />
          <LampRow on={autonomousLife} label="Auto-life" value={autonomousLife ? 'on' : 'off'} />
          <div className="flex items-center gap-2 py-1">
            <span className="hmi-lamp" style={{ background: `rgb(${eyeColor.r},${eyeColor.g},${eyeColor.b})`, boxShadow: `0 0 7px rgba(${eyeColor.r},${eyeColor.g},${eyeColor.b},.7)` }} />
            <span className="hmi-engrave text-[12px]">Eyes / Pose</span>
            <span className="ml-auto hmi-engrave text-[12px] font-semibold">{posture}{currentAnimation ? ` · ${currentAnimation.split('/').pop()}` : ''}</span>
          </div>
        </div>

        <div>
          <Label>Position</Label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <Lcd label="X·M" value={x.toFixed(2)} />
            <Lcd label="Y·M" value={y.toFixed(2)} />
            <Lcd label="θ·DEG" value={(theta * 180 / Math.PI).toFixed(0)} />
          </div>
          <MiniMap />
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <Label extra={
            <button onClick={() => setShowApiRef(true)}
              className="hmi-key px-2 py-1 rounded text-[10px] font-semibold">API Reference</button>
          }>API Log</Label>
          <div className="hmi-lcd rounded flex-1 min-h-0 overflow-auto px-3 py-2 text-[10px] leading-relaxed">
            {[...apiLog].reverse().map((entry, i) => (
              <div key={i} className="flex gap-2">
                <span className="opacity-50 min-w-[52px]">{entry.time}</span>
                <span className="font-bold min-w-[30px]">{entry.method}</span>
                <span className="opacity-80 flex-1 truncate">{entry.endpoint}</span>
              </div>
            ))}
            {apiLog.length === 0 && <div className="opacity-50">awaiting traffic…</div>}
          </div>
        </div>
      </div>

      {showApiRef && <ApiReference onClose={() => setShowApiRef(false)} />}
    </div>
  );
}
