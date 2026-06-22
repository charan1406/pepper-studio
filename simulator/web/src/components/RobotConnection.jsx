import React, { useState, useEffect, useRef } from 'react';
import { getRobotStatus, connectRobot, disconnectRobot } from '../lib/bridge';
import { usePepperStore } from '../hooks/usePepperState';

const FIELD = 'hmi-field w-full px-2.5 py-2 text-xs';

const LAMP = { connected: 'hmi-lamp-on', error: 'hmi-lamp-red', connecting: 'hmi-lamp-on', disconnected: 'hmi-lamp-off' };

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
      <div className="grid grid-cols-2 gap-2">
        <button className="hmi-key hmi-key-go px-3 py-2.5 text-[13px] font-semibold rounded-md disabled:opacity-45"
          onClick={onConnect} disabled={!host || status.state === 'connecting'}>Connect</button>
        <button className="hmi-key px-3 py-2.5 text-[13px] font-semibold rounded-md" onClick={onDisconnect}>Disconnect</button>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={'hmi-lamp ' + (LAMP[status.state] || 'hmi-lamp-off')} />
        <span className="hmi-engrave text-[11px] font-semibold">{status.state}</span>
        {status.battery != null && <span className="hmi-engrave text-[10px] opacity-60">· {status.battery}%</span>}
        {status.error && <span className="hmi-engrave text-[10px] opacity-60">· {status.error}</span>}
      </div>
      <div className="hmi-engrave text-[10px] opacity-55">Installs an SSH key on first connect — no password after that. Closing the app stops the robot bridge.</div>
      <div ref={logRef} className="hmi-lcd h-[100px] overflow-y-auto rounded p-2 text-[10px] whitespace-pre-wrap">
        {status.log || ''}
      </div>
    </div>
  );
}
