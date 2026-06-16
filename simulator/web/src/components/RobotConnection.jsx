import React, { useState, useEffect, useRef } from 'react';
import { getRobotStatus, connectRobot, disconnectRobot, setBridgeUrl } from '../lib/bridge';

const S = {
  input: { width: '100%', padding: '8px 10px', background: '#1c1c1e', border: '1px solid #3a3a3c', borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', outline: 'none', fontFamily: 'inherit', marginBottom: '6px', boxSizing: 'border-box' },
  btn: { padding: '8px 10px', background: '#3a3a3c', border: '1px solid #4a4a4c', borderRadius: '6px', color: '#e5e5e5', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' },
  primary: { padding: '8px 12px', background: '#8aba8a', border: 'none', borderRadius: '6px', color: '#1c1c1e', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' },
  log: { marginTop: '8px', height: '110px', overflowY: 'auto', background: '#0e0e10', border: '1px solid #3a3a3c', borderRadius: '6px', padding: '6px', fontSize: '10px', fontFamily: 'monospace', color: '#9aa', whiteSpace: 'pre-wrap' },
  badge: (s) => ({ fontSize: '10px', fontWeight: 600, color: s === 'connected' ? '#8aba8a' : s === 'error' ? '#ba8a8a' : '#d4a847' }),
  note: { fontSize: '10px', color: '#666', marginTop: '6px' },
};

export default function RobotConnection() {
  const [host, setHost] = useState('');
  const [user, setUser] = useState('nao');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ state: 'disconnected', log: '', battery: null, error: '', bridge_url: '' });
  const logRef = useRef(null);

  const refresh = () => getRobotStatus().then((r) => { if (r?.data) setStatus(r.data); }).catch(() => {});

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [status.log]);

  // On a successful connect, point the app's bridge URL at the robot so the
  // existing manual controls drive it.
  useEffect(() => {
    if (status.state === 'connected' && status.bridge_url) setBridgeUrl(status.bridge_url);
  }, [status.state, status.bridge_url]);

  const onConnect = async () => {
    const r = await connectRobot({ host, user, password });
    if (r?.data) setStatus(r.data);
    setPassword(''); // never keep the password around
  };

  const onDisconnect = async () => { const r = await disconnectRobot(); if (r?.data) setStatus(r.data); };

  const needsPassword = status.state !== 'connected';

  return (
    <div style={{ marginTop: '10px' }}>
      <input style={S.input} value={host} placeholder="robot IP (e.g. 192.168.1.17)"
        onChange={(e) => setHost(e.target.value)} />
      <div style={S.grid2}>
        <input style={S.input} value={user} placeholder="ssh user"
          onChange={(e) => setUser(e.target.value)} />
        {needsPassword && (
          <input style={S.input} type="password" value={password} placeholder="password (first time only)"
            onChange={(e) => setPassword(e.target.value)} />
        )}
      </div>
      <div style={S.grid2}>
        <button style={S.primary} onClick={onConnect} disabled={!host || status.state === 'connecting'}>Connect</button>
        <button style={S.btn} onClick={onDisconnect}>Disconnect</button>
      </div>
      <div style={{ marginTop: '6px' }}>
        <span style={S.badge(status.state)}>● {status.state}</span>
        {status.battery != null && <span style={{ ...S.note, marginLeft: '6px' }}>battery {status.battery}%</span>}
        {status.error && <span style={{ ...S.note, marginLeft: '6px' }}>{status.error}</span>}
      </div>
      <div style={S.note}>Installs an SSH key on first connect — no password after that. Closing the app stops the robot bridge.</div>
      <div ref={logRef} style={S.log}>{status.log || ''}</div>
    </div>
  );
}
