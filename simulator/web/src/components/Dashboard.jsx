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
      <div className="text-[8px] tracking-[2px] opacity-55 mb-1">{label}</div>
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

function MiniMap() {
  const x = usePepperStore((s) => s.x);
  const y = usePepperStore((s) => s.y);
  const theta = usePepperStore((s) => s.theta);
  const roomObjects = usePepperStore((s) => s.roomObjects);

  const mapW = 340;
  const mapH = 70;
  const scaleX = mapW / 8;
  const scaleY = mapH / 6;

  return (
    <div className="hmi-glass w-full h-[70px] rounded relative overflow-hidden">
      <svg width="100%" height={mapH} viewBox={`0 0 ${mapW} ${mapH}`} preserveAspectRatio="none">
        {Object.entries(roomObjects).map(([name, obj]) => (
          <circle key={name} cx={obj.x * scaleX} cy={mapH - obj.y * scaleY} r={3} fill="#2c4a38" />
        ))}
        <circle cx={x * scaleX} cy={mapH - y * scaleY} r={5} fill="#34d8c8" stroke="#6cf39a" strokeWidth={1} />
        <line
          x1={x * scaleX} y1={mapH - y * scaleY}
          x2={x * scaleX + Math.cos(-theta + Math.PI / 2) * 12}
          y2={mapH - y * scaleY - Math.sin(-theta + Math.PI / 2) * 12}
          stroke="#6cf39a" strokeWidth={2}
        />
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
