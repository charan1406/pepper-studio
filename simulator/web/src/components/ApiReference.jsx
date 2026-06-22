import React, { useState } from 'react';
import catalog from '../lib/api_catalog.json';
import { toCurl, toPython } from '../lib/snippets';
import { getBridgeUrl } from '../lib/bridge';

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
  const btn = 'px-2 py-1 bg-surface-2 border border-border rounded text-[10px] text-text mr-1.5 hover:border-border-strong';
  return (
    <div className="px-[18px] py-2 border-b border-border">
      <div className="text-xs font-mono">
        <span className={'font-bold mr-2 ' + (entry.method === 'GET' ? 'text-ok' : 'text-warn')}>{entry.method}</span>
        {entry.path}
      </div>
      <div className="text-[11px] text-muted my-0.5 mb-1.5">{entry.desc}</div>
      {entry.body && (
        <pre className="text-[10px] font-mono text-muted bg-bg rounded px-1.5 py-1 mb-1.5 whitespace-pre-wrap">
          {JSON.stringify(entry.body)}
        </pre>
      )}
      <button className={btn} onClick={() => copy('curl', toCurl(entry, base))}>copy curl</button>
      <button className={btn} onClick={() => copy('py', toPython(entry, base))}>copy Python</button>
      {copied && <span className="text-[10px] text-ok">{copied === 'failed' ? 'copy failed' : 'copied!'}</span>}
    </div>
  );
}

export default function ApiReference({ onClose }) {
  const sections = [...new Set(catalog.map((e) => e.section))];
  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex justify-center items-start p-10 overflow-y-auto" onClick={onClose}>
      <div className="w-[640px] max-w-full bg-surface-1 border border-border rounded-lg text-text" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-[18px] py-3.5 border-b border-border">
          <span className="text-[15px] font-bold">API Reference</span>
          <button className="bg-transparent border-none text-muted hover:text-text text-base cursor-pointer"
            aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {sections.map((sec) => (
          <div key={sec}>
            <div className="text-[10px] font-bold text-ok uppercase tracking-[1.5px] px-[18px] pt-3.5 pb-1">{sec}</div>
            {catalog.filter((e) => e.section === sec).map((e) => (
              <Entry key={`${e.method} ${e.path}`} entry={e} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
