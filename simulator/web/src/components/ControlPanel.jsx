import React, { useState, useEffect, useRef } from 'react';
import {
  moveVelocity, stopMove, setPosture, speak, stopSpeak,
  setEyeColor, listAnimations, runAnimation, setHead,
  POSTURES, HEAD_LIMITS,
} from '../lib/bridge';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, RotateCw, Settings } from 'lucide-react';
import { usePepperStore } from '../hooks/usePepperState';
import VoicePanel from './VoicePanel';
import EyeColorControl from './EyeColorControl';

function Section({ title, aside, children }) {
  return (
    <section className="px-5 py-4 border-b border-white/10">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="hmi-engrave text-[11px] font-bold uppercase tracking-[2px]">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function MetalBtn({ go, className = '', ...props }) {
  return (
    <button
      className={'hmi-key ' + (go ? 'hmi-key-go ' : '') + 'px-3 py-2.5 text-[13px] font-semibold ' + className}
      {...props}
    />
  );
}

// D-pad cell — press-and-hold drives, release stops. aria-labels keep the
// controls findable + accessible.
function PadKey({ label, icon: Icon, vx, vy, vtheta }) {
  return (
    <button aria-label={label}
      onMouseDown={() => moveVelocity(vx, vy, vtheta)} onMouseUp={() => stopMove()} onMouseLeave={() => stopMove()}
      className="hmi-key-dark h-14 flex items-center justify-center">
      <Icon size={22} />
    </button>
  );
}

function EStop() {
  return (
    <div className="hmi-estop-ring rounded-full p-2.5">
      <button aria-label="Stop" onClick={() => stopMove()}
        className="hmi-estop w-[88px] h-[88px] rounded-full text-sm">STOP</button>
    </div>
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

  // Live swatch updates instantly; the bridge POST is debounced so dragging
  // the wheel doesn't flood /leds/eyes.
  const eyeTimer = useRef(null);
  const onEyeChange = (hex) => {
    setEye(hex);
    clearTimeout(eyeTimer.current);
    eyeTimer.current = setTimeout(() => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      setEyeColor(r, g, b);
    }, 90);
  };

  return (
    <div className="hmi-panel w-[348px] h-full border-r border-white/10 flex flex-col">
      <header className="hmi-plate flex items-center justify-between px-5 h-14 border-b border-white/10 shrink-0">
        <span className="hmi-engrave text-[13px] font-bold uppercase tracking-[2px]">Manual Control</span>
        <button onClick={toggleSettings} aria-label="Open setup"
          className="hmi-key w-8 h-8 flex items-center justify-center rounded-md">
          <Settings size={15} />
        </button>
      </header>

      {/* Distribute the sections down the full height so the panel fills edge
          to edge instead of stacking at the top with dead space below. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-between">
      <Section title="Drive" aside={<span className="hmi-engrave text-[11px] opacity-70">hold to move</span>}>
        <div className="flex gap-4 items-center">
          <div className="grid grid-cols-3 gap-2 flex-1">
            <PadKey label="Rotate left" icon={RotateCcw} vx={0} vy={0} vtheta={1} />
            <PadKey label="Forward" icon={ArrowUp} vx={1} vy={0} vtheta={0} />
            <PadKey label="Rotate right" icon={RotateCw} vx={0} vy={0} vtheta={-1} />
            <PadKey label="Left" icon={ArrowLeft} vx={0} vy={1} vtheta={0} />
            <span />
            <PadKey label="Right" icon={ArrowRight} vx={0} vy={-1} vtheta={0} />
            <span />
            <PadKey label="Back" icon={ArrowDown} vx={-1} vy={0} vtheta={0} />
            <span />
          </div>
          <EStop />
        </div>
      </Section>

      <Section title="Posture">
        <div className="grid grid-cols-2 gap-2.5">
          {POSTURES.map((p) => (
            <MetalBtn key={p} onClick={() => setPosture(p, 0.5)}>{p}</MetalBtn>
          ))}
        </div>
      </Section>

      <Section title="Head">
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="hmi-lcd px-3 py-2 flex items-baseline justify-between">
            <span className="text-[9px] opacity-70 tracking-widest">YAW</span>
            <span className="text-[15px]">{yaw.toFixed(2)}</span>
          </div>
          <div className="hmi-lcd px-3 py-2 flex items-baseline justify-between">
            <span className="text-[9px] opacity-70 tracking-widest">PITCH</span>
            <span className="text-[15px]">{pitch.toFixed(2)}</span>
          </div>
        </div>
        <input type="range" className="w-full accent-[#2c9c84] mb-3"
          min={HEAD_LIMITS.yaw[0]} max={HEAD_LIMITS.yaw[1]} step={0.01} value={yaw}
          onChange={(e) => { const v = parseFloat(e.target.value); setYaw(v); setHead(v, pitch); }} />
        <input type="range" className="w-full accent-[#2c9c84] mb-4"
          min={HEAD_LIMITS.pitch[0]} max={HEAD_LIMITS.pitch[1]} step={0.01} value={pitch}
          onChange={(e) => { const v = parseFloat(e.target.value); setPitch(v); setHead(yaw, v); }} />
        <MetalBtn className="w-full" onClick={() => { setYaw(0); setPitch(0); setHead(0, 0); }}>Center</MetalBtn>
      </Section>

      <Section title="Speak">
        <input className="hmi-field w-full px-3 py-2.5 text-sm mb-2.5" value={text} placeholder="Say something..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSpeak(); }} />
        <div className="grid grid-cols-2 gap-2.5">
          <MetalBtn go onClick={onSpeak}>Speak</MetalBtn>
          <MetalBtn onClick={() => stopSpeak()}>Stop</MetalBtn>
        </div>
      </Section>

      <Section title="Voice"><VoicePanel /></Section>

      <Section title="Eyes">
        <EyeColorControl value={eye} onChange={onEyeChange} />
      </Section>

      <Section title="Animation">
        <select className="hmi-field w-full px-3 py-2.5 text-sm mb-2.5" value={selectedAnim}
          onChange={(e) => setSelectedAnim(e.target.value)}>
          {animations.map((a) => (
            <option key={a} value={a}>{a.split('/').pop()}</option>
          ))}
        </select>
        <MetalBtn go className="w-full" disabled={!selectedAnim}
          onClick={() => selectedAnim && runAnimation(selectedAnim)}>Run</MetalBtn>
      </Section>
      </div>
    </div>
  );
}
