import React, { useState } from 'react';
import catalog from '../lib/api_catalog.json';
import { toCurl, toPython } from '../lib/snippets';
import { getBridgeUrl } from '../lib/bridge';

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 16px', overflowY: 'auto' },
  panel: { width: '640px', maxWidth: '100%', background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: '10px', fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif", color: '#e5e5e5' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #3a3a3c' },
  title: { fontSize: '15px', fontWeight: 700 },
  close: { background: 'none', border: 'none', color: '#999', fontSize: '16px', cursor: 'pointer' },
  section: { fontSize: '10px', fontWeight: 700, color: '#8aba8a', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '14px 18px 4px' },
  entry: { padding: '8px 18px', borderBottom: '1px solid #333' },
  sig: { fontSize: '12px', fontFamily: 'monospace' },
  method: (m) => ({ fontWeight: 700, marginRight: '8px', color: m === 'GET' ? '#8aba8a' : '#d4a847' }),
  desc: { fontSize: '11px', color: '#999', margin: '2px 0 6px' },
  body: { fontSize: '10px', fontFamily: 'monospace', color: '#9aa', background: '#1c1c1e', borderRadius: '4px', padding: '4px 6px', margin: '0 0 6px', whiteSpace: 'pre-wrap' },
  btn: { padding: '3px 8px', background: '#3a3a3c', border: '1px solid #4a4a4c', borderRadius: '5px', color: '#e5e5e5', fontSize: '10px', cursor: 'pointer', marginRight: '6px', fontFamily: 'inherit' },
};

function Entry({ entry }) {
  const [copied, setCopied] = useState('');
  const copy = async (kind, text) => {
    try {
      await navigator.clipboard.writeText(text);  // await so a rejected write hits catch
      setCopied(kind);
      setTimeout(() => setCopied(''), 1200);
    } catch {
      setCopied('failed');
    }
  };
  const base = getBridgeUrl();
  return (
    <div style={S.entry}>
      <div style={S.sig}><span style={S.method(entry.method)}>{entry.method}</span>{entry.path}</div>
      <div style={S.desc}>{entry.desc}</div>
      {entry.body && <pre style={S.body}>{JSON.stringify(entry.body)}</pre>}
      <button style={S.btn} onClick={() => copy('curl', toCurl(entry, base))}>copy curl</button>
      <button style={S.btn} onClick={() => copy('py', toPython(entry, base))}>copy Python</button>
      {copied && <span style={{ fontSize: '10px', color: '#8aba8a' }}>{copied === 'failed' ? 'copy failed' : 'copied!'}</span>}
    </div>
  );
}

export default function ApiReference({ onClose }) {
  const sections = [...new Set(catalog.map((e) => e.section))];
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <span style={S.title}>API Reference</span>
          <button style={S.close} aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {sections.map((sec) => (
          <div key={sec}>
            <div style={S.section}>{sec}</div>
            {catalog.filter((e) => e.section === sec).map((e) => (
              <Entry key={`${e.method} ${e.path}`} entry={e} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
