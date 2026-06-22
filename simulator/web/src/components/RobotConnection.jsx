import React, { useState, useEffect, useRef } from 'react';
import { getRobotStatus, connectRobot, disconnectRobot } from '../lib/bridge';
import { usePepperStore } from '../hooks/usePepperState';
import { Button } from '../design';

const FIELD = 'w-full rounded-md bg-surface-1 border border-border px-2.5 py-2 text-xs text-text '
  + 'placeholder:text-dim focus:outline-none focus:border-accent/60 focus:ring-[3px] focus:ring-accent-soft';

const STATE_TONE = { connected: 'text-ok', error: 'text-danger', connecting: 'text-warn', disconnected: 'text-muted' };

export default function RobotConnection() {
  const [host, setHost] = useState('');
  const [user, setUser] = useState('nao');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ state: 'disconnected', log: '', battery: null, error: '', bridge_url: '' });
  const logRef = useRef(null);
  const setMode = usePepperStore((s) => s.setMode);
  const setRobotBridgeUrl = usePepperStore((s) => s.setRobotBridgeUrl);

  const refresh = () => getRobotStatus().then((r) => { if (r?.data) setStatus(r.data); }).catch(() => {});

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [status.log]);

  // Connection state drives the bridge-target dial: connected → flip to 'real'
  // and publish the robot's bridge URL (useBridgeTarget points controls at it);
  // otherwise clear it and fall back to 'sim'.
  useEffect(() => {
    if (status.state === 'connected' && status.bridge_url) {
      setRobotBridgeUrl(status.bridge_url);
      setMode('real');
    } else if (status.state === 'disconnected') {
      setRobotBridgeUrl('');
      setMode('sim');
    }
  }, [status.state, status.bridge_url, setMode, setRobotBridgeUrl]);

  const onConnect = async () => {
    const r = await connectRobot({ host, user, password });
    if (r?.data) setStatus(r.data);
    setPassword(''); // never keep the password around
  };

  const onDisconnect = async () => { const r = await disconnectRobot(); if (r?.data) setStatus(r.data); };

  const needsPassword = status.state !== 'connected';

  return (
    <div className="mt-2.5 space-y-1.5">
      <input className={FIELD} value={host} placeholder="robot IP (e.g. 192.168.1.17)"
        onChange={(e) => setHost(e.target.value)} />
      <div className="grid grid-cols-2 gap-1.5">
        <input className={FIELD} value={user} placeholder="ssh user" onChange={(e) => setUser(e.target.value)} />
        {needsPassword && (
          <input className={FIELD} type="password" value={password} placeholder="password (first time only)"
            onChange={(e) => setPassword(e.target.value)} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button onClick={onConnect} disabled={!host || status.state === 'connecting'}>Connect</Button>
        <Button variant="secondary" onClick={onDisconnect}>Disconnect</Button>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={'text-[10px] font-semibold ' + (STATE_TONE[status.state] || 'text-muted')}>● {status.state}</span>
        {status.battery != null && <span className="text-[10px] text-dim">battery {status.battery}%</span>}
        {status.error && <span className="text-[10px] text-dim">{status.error}</span>}
      </div>
      <div className="text-[10px] text-dim">Installs an SSH key on first connect — no password after that. Closing the app stops the robot bridge.</div>
      <div ref={logRef} className="h-[110px] overflow-y-auto bg-bg border border-border rounded-md p-1.5 text-[10px] font-mono text-muted whitespace-pre-wrap">
        {status.log || ''}
      </div>
    </div>
  );
}
