import React, { useState, useEffect } from 'react';
import {
  moveVelocity, stopMove, setPosture, speak, stopSpeak,
  setEyeColor, listAnimations, runAnimation, setHead,
  getBridgeUrl, setBridgeUrl, POSTURES, HEAD_LIMITS,
} from '../lib/bridge';
import AISettings from './AISettings';
import RobotConnection from './RobotConnection';
import VoicePanel from './VoicePanel';
import ServicesPanel from './ServicesPanel';

const C = {
  panel: {
    width: '300px', height: '100vh', background: '#2c2c2e',
    borderRight: '1px solid #3a3a3c', display: 'flex', flexDirection: 'column',
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif", fontSize: '12px',
    color: '#999', overflowY: 'auto',
  },
  header: { padding: '16px 20px', borderBottom: '1px solid #3a3a3c' },
  title: { fontSize: '16px', fontWeight: 700, color: '#e5e5e5', letterSpacing: '-0.5px' },
  section: { padding: '12px 20px', borderBottom: '1px solid #3a3a3c' },
  sectionTitle: {
    fontSize: '10px', fontWeight: 600, color: '#666', textTransform: 'uppercase',
    letterSpacing: '1.5px', marginBottom: '10px',
  },
  btn: {
    padding: '8px 10px', background: '#3a3a3c', border: '1px solid #4a4a4c',
    borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primary: {
    padding: '8px 12px', background: '#8aba8a', border: 'none', borderRadius: '6px',
    color: '#1c1c1e', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  },
  input: {
    flex: 1, padding: '8px 10px', background: '#1c1c1e', border: '1px solid #3a3a3c',
    borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', outline: 'none', fontFamily: 'inherit',
  },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' },
  row: { display: 'flex', gap: '6px', alignItems: 'center' },
  sliderRow: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' },
};

function MoveButton({ label, vx, vy, vtheta }) {
  const down = () => moveVelocity(vx, vy, vtheta);
  const up = () => stopMove();
  return (
    <button
      style={C.btn}
      onMouseDown={down}
      onMouseUp={up}
      onMouseLeave={up}
      aria-label={label}
    >{label}</button>
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

  return (
    <div style={C.panel}>
      <div style={C.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={C.title}>Manual Control</div>
          <button
            style={{ ...C.btn, padding: '4px 8px', fontSize: '11px' }}
            onClick={() => { setUrlDraft(getBridgeUrl()); setShowSettings((s) => !s); }}
          >Bridge URL</button>
        </div>
        {showSettings && (
          <div style={{ marginTop: '10px' }}>
            <input
              style={{ ...C.input, width: '100%', marginBottom: '6px' }}
              value={urlDraft}
              placeholder="http://localhost:5001"
              onChange={(e) => setUrlDraft(e.target.value)}
            />
            <div style={C.grid2}>
              <button style={C.primary} onClick={() => { setBridgeUrl(urlDraft); setShowSettings(false); }}>Save</button>
              <button style={C.btn} onClick={() => { setBridgeUrl(''); setUrlDraft(getBridgeUrl()); }}>Reset</button>
            </div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>
              Or connect a real Pepper below — it sets this URL automatically.
            </div>
            <div style={{ ...C.sectionTitle, marginTop: '12px' }}>Robot Connection</div>
            <RobotConnection />
          </div>
        )}
        <AISettings />
      </div>

      {/* Voice */}
      <div style={C.section}>
        <div style={C.sectionTitle}>Voice</div>
        <VoicePanel />
      </div>

      {/* Services */}
      <div style={C.section}>
        <div style={C.sectionTitle}>Services</div>
        <ServicesPanel />
      </div>

      {/* Movement */}
      <div style={C.section}>
        <div style={C.sectionTitle}>Movement</div>
        <div style={{ ...C.grid3, marginBottom: '6px' }}>
          <MoveButton label="Rotate L" vx={0} vy={0} vtheta={1} />
          <MoveButton label="Forward" vx={1} vy={0} vtheta={0} />
          <MoveButton label="Rotate R" vx={0} vy={0} vtheta={-1} />
          <MoveButton label="Left" vx={0} vy={1} vtheta={0} />
          <MoveButton label="Back" vx={-1} vy={0} vtheta={0} />
          <MoveButton label="Right" vx={0} vy={-1} vtheta={0} />
        </div>
        <button style={{ ...C.btn, width: '100%' }} onClick={() => stopMove()}>&#9632; Stop</button>
      </div>

      {/* Posture */}
      <div style={C.section}>
        <div style={C.sectionTitle}>Posture</div>
        <div style={C.grid3}>
          {POSTURES.map((p) => (
            <button key={p} style={C.btn} onClick={() => setPosture(p, 0.5)}>{p}</button>
          ))}
        </div>
      </div>

      {/* Speak */}
      <div style={C.section}>
        <div style={C.sectionTitle}>Speak</div>
        <div style={{ ...C.row, marginBottom: '6px' }}>
          <input
            style={C.input}
            value={text}
            placeholder="Say something..."
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSpeak(); }}
          />
        </div>
        <div style={C.grid2}>
          <button style={C.primary} onClick={onSpeak}>Speak</button>
          <button style={C.btn} onClick={() => stopSpeak()}>Stop</button>
        </div>
      </div>

      {/* Eyes */}
      <div style={C.section}>
        <div style={C.sectionTitle}>Eye Color</div>
        <div style={C.row}>
          <input type="color" value={eye} onChange={(e) => onEyeChange(e.target.value)}
            style={{ width: '40px', height: '32px', background: 'none', border: '1px solid #3a3a3c', borderRadius: '6px', cursor: 'pointer' }} />
          <span style={{ color: '#666' }}>{eye}</span>
        </div>
      </div>

      {/* Animation */}
      <div style={C.section}>
        <div style={C.sectionTitle}>Animation</div>
        <div style={{ ...C.row, marginBottom: '6px' }}>
          <select
            style={C.input}
            value={selectedAnim}
            onChange={(e) => setSelectedAnim(e.target.value)}
          >
            {animations.map((a) => (
              <option key={a} value={a}>{a.split('/').pop()}</option>
            ))}
          </select>
        </div>
        <button style={{ ...C.primary, width: '100%' }} disabled={!selectedAnim}
          onClick={() => selectedAnim && runAnimation(selectedAnim)}>Run</button>
      </div>

      {/* Head */}
      <div style={C.section}>
        <div style={C.sectionTitle}>Head</div>
        <div style={C.sliderRow}>
          <span>Yaw: {yaw.toFixed(2)}</span>
          <input type="range" min={HEAD_LIMITS.yaw[0]} max={HEAD_LIMITS.yaw[1]} step={0.01}
            value={yaw}
            onChange={(e) => { const v = parseFloat(e.target.value); setYaw(v); setHead(v, pitch); }} />
        </div>
        <div style={C.sliderRow}>
          <span>Pitch: {pitch.toFixed(2)}</span>
          <input type="range" min={HEAD_LIMITS.pitch[0]} max={HEAD_LIMITS.pitch[1]} step={0.01}
            value={pitch}
            onChange={(e) => { const v = parseFloat(e.target.value); setPitch(v); setHead(yaw, v); }} />
        </div>
        <button style={{ ...C.btn, width: '100%' }}
          onClick={() => { setYaw(0); setPitch(0); setHead(0, 0); }}>Center</button>
      </div>
    </div>
  );
}
