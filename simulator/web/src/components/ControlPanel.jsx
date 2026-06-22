import React, { useState, useEffect } from 'react';
import {
  moveVelocity, stopMove, setPosture, speak, stopSpeak,
  setEyeColor, listAnimations, runAnimation, setHead,
  getBridgeUrl, setBridgeUrl, POSTURES, HEAD_LIMITS,
} from '../lib/bridge';
import { Button, Input } from '../design';
import AISettings from './AISettings';
import RobotConnection from './RobotConnection';
import VoicePanel from './VoicePanel';
import ServicesPanel from './ServicesPanel';

function Section({ title, children }) {
  return (
    <section className="px-4 py-3 border-b border-border">
      <h3 className="text-[10px] font-semibold text-dim uppercase tracking-[1.5px] mb-2.5">{title}</h3>
      {children}
    </section>
  );
}

function MoveButton({ label, vx, vy, vtheta }) {
  const down = () => moveVelocity(vx, vy, vtheta);
  const up = () => stopMove();
  return (
    <Button variant="secondary" onMouseDown={down} onMouseUp={up} onMouseLeave={up} aria-label={label}>
      {label}
    </Button>
  );
}

export default function ControlPanel() {
  const [text, setText] = useState('');
  const [eye, setEye] = useState('#ffffff');
  const [animations, setAnimations] = useState([]);
  const [selectedAnim, setSelectedAnim] = useState('');
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [urlDraft, setUrlDraft] = useState(getBridgeUrl());

  useEffect(() => {
    listAnimations()
      .then((res) => {
        const list = res?.data?.animations ?? [];
        setAnimations(list);
        if (list.length) setSelectedAnim(list[0]);
      })
      .catch(() => setAnimations([]));
  }, []);

  const onSpeak = () => {
    const t = text.trim();
    if (t) speak(t);
  };

  const onEyeChange = (hex) => {
    setEye(hex);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    setEyeColor(r, g, b);
  };

  const selectCls = 'w-full rounded-md bg-surface-1 border border-border px-3 py-2 text-sm text-text '
    + 'focus:outline-none focus:border-accent/60 focus:ring-[3px] focus:ring-accent-soft';

  return (
    <div className="w-[300px] h-full bg-surface-1 border-r border-border flex flex-col overflow-y-auto">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-text">Manual Control</div>
          <Button variant="ghost" className="px-2 py-1 text-[11px]"
            onClick={() => { setUrlDraft(getBridgeUrl()); setShowSettings((s) => !s); }}>Bridge URL</Button>
        </div>
        {showSettings && (
          <div className="mt-2.5">
            <Input className="w-full" value={urlDraft} placeholder="http://localhost:5001"
              onChange={(e) => setUrlDraft(e.target.value)} />
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              <Button onClick={() => { setBridgeUrl(urlDraft); setShowSettings(false); }}>Save</Button>
              <Button variant="secondary" onClick={() => { setBridgeUrl(''); setUrlDraft(getBridgeUrl()); }}>Reset</Button>
            </div>
            <p className="text-[10px] text-dim mt-1.5">Or connect a real Pepper below — it sets this URL automatically.</p>
            <h3 className="text-[10px] font-semibold text-dim uppercase tracking-[1.5px] mt-3">Robot Connection</h3>
            <RobotConnection />
          </div>
        )}
        <AISettings />
      </div>

      <Section title="Voice"><VoicePanel /></Section>
      <Section title="Services"><ServicesPanel /></Section>

      <Section title="Movement">
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          <MoveButton label="Rotate L" vx={0} vy={0} vtheta={1} />
          <MoveButton label="Forward" vx={1} vy={0} vtheta={0} />
          <MoveButton label="Rotate R" vx={0} vy={0} vtheta={-1} />
          <MoveButton label="Left" vx={0} vy={1} vtheta={0} />
          <MoveButton label="Back" vx={-1} vy={0} vtheta={0} />
          <MoveButton label="Right" vx={0} vy={-1} vtheta={0} />
        </div>
        <Button variant="secondary" className="w-full" onClick={() => stopMove()}>&#9632; Stop</Button>
      </Section>

      <Section title="Posture">
        <div className="grid grid-cols-3 gap-1.5">
          {POSTURES.map((p) => (
            <Button key={p} variant="secondary" onClick={() => setPosture(p, 0.5)}>{p}</Button>
          ))}
        </div>
      </Section>

      <Section title="Speak">
        <Input className="w-full mb-1.5" value={text} placeholder="Say something..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSpeak(); }} />
        <div className="grid grid-cols-2 gap-1.5">
          <Button onClick={onSpeak}>Speak</Button>
          <Button variant="secondary" onClick={() => stopSpeak()}>Stop</Button>
        </div>
      </Section>

      <Section title="Eye Color">
        <div className="flex items-center gap-2">
          <input type="color" value={eye} onChange={(e) => onEyeChange(e.target.value)}
            className="w-10 h-8 bg-transparent border border-border rounded-md cursor-pointer" />
          <span className="text-dim text-sm">{eye}</span>
        </div>
      </Section>

      <Section title="Animation">
        <select className={selectCls + ' mb-1.5'} value={selectedAnim}
          onChange={(e) => setSelectedAnim(e.target.value)}>
          {animations.map((a) => (
            <option key={a} value={a}>{a.split('/').pop()}</option>
          ))}
        </select>
        <Button className="w-full" disabled={!selectedAnim}
          onClick={() => selectedAnim && runAnimation(selectedAnim)}>Run</Button>
      </Section>

      <Section title="Head">
        <div className="flex flex-col gap-1 mb-2 text-sm text-muted">
          <span>Yaw: {yaw.toFixed(2)}</span>
          <input type="range" className="accent-[var(--color-accent)]"
            min={HEAD_LIMITS.yaw[0]} max={HEAD_LIMITS.yaw[1]} step={0.01} value={yaw}
            onChange={(e) => { const v = parseFloat(e.target.value); setYaw(v); setHead(v, pitch); }} />
        </div>
        <div className="flex flex-col gap-1 mb-2 text-sm text-muted">
          <span>Pitch: {pitch.toFixed(2)}</span>
          <input type="range" className="accent-[var(--color-accent)]"
            min={HEAD_LIMITS.pitch[0]} max={HEAD_LIMITS.pitch[1]} step={0.01} value={pitch}
            onChange={(e) => { const v = parseFloat(e.target.value); setPitch(v); setHead(yaw, v); }} />
        </div>
        <Button variant="secondary" className="w-full"
          onClick={() => { setYaw(0); setPitch(0); setHead(0, 0); }}>Center</Button>
      </Section>
    </div>
  );
}
