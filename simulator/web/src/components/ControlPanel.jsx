import React, { useState, useEffect } from 'react';
import {
  moveVelocity, stopMove, setPosture, speak, stopSpeak,
  setEyeColor, listAnimations, runAnimation, setHead,
  POSTURES, HEAD_LIMITS,
} from '../lib/bridge';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, RotateCw, Square, Settings } from 'lucide-react';
import { Button, Input } from '../design';
import { usePepperStore } from '../hooks/usePepperState';
import VoicePanel from './VoicePanel';

function Section({ title, aside, children }) {
  return (
    <section className="px-4 py-4 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold text-dim uppercase tracking-[2px]">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

// A directional pad cell. Press-and-hold drives; release stops. The center
// cell is a hard stop. aria-labels keep the controls findable + accessible.
function PadButton({ label, icon: Icon, vx, vy, vtheta, stop }) {
  const base = 'h-12 flex items-center justify-center rounded-md select-none transition-colors '
    + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50';
  if (stop) {
    return (
      <button aria-label="Stop" onClick={() => stopMove()}
        className={base + ' bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20'}>
        <Icon size={17} fill="currentColor" />
      </button>
    );
  }
  return (
    <button aria-label={label}
      onMouseDown={() => moveVelocity(vx, vy, vtheta)} onMouseUp={() => stopMove()} onMouseLeave={() => stopMove()}
      className={base + ' bg-surface-2 border border-border text-muted hover:text-text hover:border-accent/60 active:bg-accent/15 active:border-accent active:text-accent'}>
      <Icon size={19} />
    </button>
  );
}

export default function ControlPanel() {
  const [text, setText] = useState('');
  const [eye, setEye] = useState('#ffffff');
  const [animations, setAnimations] = useState([]);
  const [selectedAnim, setSelectedAnim] = useState('');
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const toggleSettings = usePepperStore((s) => s.toggleSettings);

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
    <div className="w-[320px] h-full bg-surface-1 border-r border-border flex flex-col overflow-y-auto">
      <header className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <span className="text-sm font-semibold text-text">Manual Control</span>
        <button onClick={toggleSettings} aria-label="Open setup"
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-text hover:bg-surface-2">
          <Settings size={15} />
        </button>
      </header>

      <Section title="Move" aside={<span className="text-[10px] text-dim">hold to drive</span>}>
        <div className="grid grid-cols-3 gap-2">
          <PadButton label="Rotate left" icon={RotateCcw} vx={0} vy={0} vtheta={1} />
          <PadButton label="Forward" icon={ArrowUp} vx={1} vy={0} vtheta={0} />
          <PadButton label="Rotate right" icon={RotateCw} vx={0} vy={0} vtheta={-1} />
          <PadButton label="Left" icon={ArrowLeft} vx={0} vy={1} vtheta={0} />
          <PadButton stop icon={Square} />
          <PadButton label="Right" icon={ArrowRight} vx={0} vy={-1} vtheta={0} />
          <span />
          <PadButton label="Back" icon={ArrowDown} vx={-1} vy={0} vtheta={0} />
          <span />
        </div>
      </Section>

      <Section title="Posture">
        <div className="grid grid-cols-2 gap-1.5">
          {POSTURES.map((p) => (
            <Button key={p} variant="secondary" onClick={() => setPosture(p, 0.5)}>{p}</Button>
          ))}
        </div>
      </Section>

      <Section title="Head">
        <div className="flex flex-col gap-1 mb-2 text-sm text-muted">
          <div className="flex justify-between"><span>Yaw</span><span className="font-mono text-text">{yaw.toFixed(2)}</span></div>
          <input type="range" className="accent-[var(--color-accent)]"
            min={HEAD_LIMITS.yaw[0]} max={HEAD_LIMITS.yaw[1]} step={0.01} value={yaw}
            onChange={(e) => { const v = parseFloat(e.target.value); setYaw(v); setHead(v, pitch); }} />
        </div>
        <div className="flex flex-col gap-1 mb-2.5 text-sm text-muted">
          <div className="flex justify-between"><span>Pitch</span><span className="font-mono text-text">{pitch.toFixed(2)}</span></div>
          <input type="range" className="accent-[var(--color-accent)]"
            min={HEAD_LIMITS.pitch[0]} max={HEAD_LIMITS.pitch[1]} step={0.01} value={pitch}
            onChange={(e) => { const v = parseFloat(e.target.value); setPitch(v); setHead(yaw, v); }} />
        </div>
        <Button variant="secondary" className="w-full"
          onClick={() => { setYaw(0); setPitch(0); setHead(0, 0); }}>Center</Button>
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

      <Section title="Voice"><VoicePanel /></Section>

      <Section title="Eyes">
        <div className="flex items-center gap-2">
          <input type="color" value={eye} onChange={(e) => onEyeChange(e.target.value)}
            className="w-10 h-8 bg-transparent border border-border rounded-md cursor-pointer" />
          <span className="text-dim text-sm font-mono">{eye}</span>
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
    </div>
  );
}
