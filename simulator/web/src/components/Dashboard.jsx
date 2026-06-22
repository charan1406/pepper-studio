import React, { useState } from 'react';
import { usePepperStore } from '../hooks/usePepperState';
import ApiReference from './ApiReference';

/**
 * Dashboard panel: connection/status, position + minimap, speech, key joints,
 * and the live API call log.
 */

function Row({ label, children }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-dim">{label}</span>
      <span className="text-text">{children}</span>
    </div>
  );
}

function Section({ title, extra, children }) {
  return (
    <div className="px-5 py-3 border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-sans text-[10px] font-semibold text-dim uppercase tracking-[1.5px]">{title}</h3>
        {extra}
      </div>
      {children}
    </div>
  );
}

function MiniMap() {
  const x = usePepperStore((s) => s.x);
  const y = usePepperStore((s) => s.y);
  const theta = usePepperStore((s) => s.theta);
  const roomObjects = usePepperStore((s) => s.roomObjects);

  const mapW = 340;
  const mapH = 80;
  const scaleX = mapW / 8;
  const scaleY = mapH / 6;

  return (
    <div className="w-full h-20 bg-bg rounded-md border border-border relative mt-1 overflow-hidden">
      <svg width={mapW} height={mapH} viewBox={`0 0 ${mapW} ${mapH}`}>
        {Object.entries(roomObjects).map(([name, obj]) => (
          <circle key={name} cx={obj.x * scaleX} cy={mapH - obj.y * scaleY} r={3} fill="#3a3a3c" />
        ))}
        <circle cx={x * scaleX} cy={mapH - y * scaleY} r={5} fill="#7c7cf0" stroke="#9a9af5" strokeWidth={1} />
        <line
          x1={x * scaleX} y1={mapH - y * scaleY}
          x2={x * scaleX + Math.cos(-theta + Math.PI / 2) * 12}
          y2={mapH - y * scaleY - Math.sin(-theta + Math.PI / 2) * 12}
          stroke="#7c7cf0" strokeWidth={2}
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
  const isSpeaking = usePepperStore((s) => s.isSpeaking);
  const currentSpeech = usePepperStore((s) => s.currentSpeech);
  const speechLanguage = usePepperStore((s) => s.speechLanguage);
  const isMoving = usePepperStore((s) => s.isMoving);
  const eyeColor = usePepperStore((s) => s.eyeColor);
  const autonomousLife = usePepperStore((s) => s.autonomousLife);
  const faceTracking = usePepperStore((s) => s.faceTracking);
  const currentAnimation = usePepperStore((s) => s.currentAnimation);
  const uptime = usePepperStore((s) => s.uptime);
  const apiLog = usePepperStore((s) => s.apiLog);
  const joints = usePepperStore((s) => s.joints);

  const [showApiRef, setShowApiRef] = useState(false);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const batteryTone = battery > 50 ? 'text-ok' : battery > 20 ? 'text-warn' : 'text-danger';

  return (
    <div className="w-[380px] h-full bg-surface-1 border-l border-border flex flex-col overflow-hidden font-mono text-[11px] text-muted">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
        <div className={'w-2 h-2 rounded-full ' + (connected ? 'bg-ok' : 'bg-danger')} />
        <div className="font-sans text-base font-bold text-text tracking-tight">Pepper Simulator</div>
        <div className="ml-auto text-[10px] text-dim">{connected ? 'LIVE' : 'OFFLINE'}</div>
      </div>

      <Section title="Status">
        <Row label="Battery"><span className={batteryTone + ' font-semibold'}>{battery}%</span></Row>
        <Row label="Posture">{posture}</Row>
        <Row label="Uptime">{formatTime(uptime)}</Row>
        <div className="flex justify-between py-0.5">
          <span className="text-dim">Moving</span>
          <span className={isMoving ? 'text-ok' : 'text-dim'}>{isMoving ? 'YES' : 'no'}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-dim">Eyes</span>
          <span style={{ color: `rgb(${eyeColor.r},${eyeColor.g},${eyeColor.b})` }}>
            ● rgb({eyeColor.r},{eyeColor.g},{eyeColor.b})
          </span>
        </div>
        <Row label="Auto Life">{autonomousLife ? 'on' : 'off'}</Row>
        {currentAnimation && (
          <div className="flex justify-between py-0.5">
            <span className="text-dim">Animation</span>
            <span className="text-warn">{currentAnimation.split('/').pop()}</span>
          </div>
        )}
      </Section>

      <Section title="Position">
        <div className="flex gap-4 mt-1">
          <span>x: <span className="text-text">{x.toFixed(2)}m</span></span>
          <span>y: <span className="text-text">{y.toFixed(2)}m</span></span>
          <span>θ: <span className="text-text">{(theta * 180 / Math.PI).toFixed(1)}°</span></span>
        </div>
        <MiniMap />
      </Section>

      <Section title={<>Speech {isSpeaking && <span className="text-ok normal-case tracking-normal">● speaking ({speechLanguage})</span>}</>}>
        <div className="bg-bg rounded-md px-3 py-2 mt-1 text-text italic min-h-[24px] break-words">
          {currentSpeech || '(silent)'}
        </div>
      </Section>

      <Section title="Key Joints (rad)">
        {['HeadYaw', 'HeadPitch', 'LShoulderPitch', 'RShoulderPitch'].map((j) => (
          <Row key={j} label={j}>{(joints[j] ?? 0).toFixed(3)}</Row>
        ))}
      </Section>

      <Section title="API Log" extra={
        <button onClick={() => setShowApiRef(true)}
          className="px-2 py-1 bg-surface-2 border border-border rounded text-[10px] text-text hover:border-border-strong">
          API Reference
        </button>
      } />
      {showApiRef && <ApiReference onClose={() => setShowApiRef(false)} />}
      <div className="flex-1 overflow-auto px-5 py-3">
        {[...apiLog].reverse().map((entry, i) => (
          <div key={i} className="flex gap-2 py-1 border-b border-bg text-[10px]">
            <span className="text-dim min-w-[55px]">{entry.time}</span>
            <span className={'font-semibold min-w-[32px] ' + (entry.method === 'POST' ? 'text-warn' : 'text-ok')}>{entry.method}</span>
            <span className="text-muted flex-1">{entry.endpoint}</span>
          </div>
        ))}
        {apiLog.length === 0 && <div className="text-dim italic">Waiting for API calls...</div>}
      </div>
    </div>
  );
}
