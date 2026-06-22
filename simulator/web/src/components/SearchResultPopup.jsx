import React, { useEffect } from 'react';
import { usePepperStore } from '../hooks/usePepperState';

function SearchResultCard({ result, onDismiss }) {
  useEffect(() => {
    const remaining = result.dismissAt - Date.now();
    if (remaining <= 0) { onDismiss(); return; }
    const timer = setTimeout(onDismiss, remaining);
    return () => clearTimeout(timer);
  }, [result.dismissAt, onDismiss]);

  return (
    <div className="w-[320px] bg-surface-1 border border-border rounded-lg overflow-hidden shadow-2xl"
      style={{ animation: 'slideInRight 0.3s ease-out' }}>
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[11px] text-muted">Search: "{result.query}"</span>
        <span onClick={onDismiss} className="cursor-pointer text-dim hover:text-text text-xs">✕</span>
      </div>
      <div className="px-3 py-2.5">
        {(result.results || []).slice(0, 1).map((r, i) => (
          <div key={i}>
            <div className="text-[13px] font-semibold text-text mb-1">{r.title}</div>
            <div className="text-xs text-muted leading-relaxed mb-1">{r.snippet}</div>
            <div className="text-[10px] text-dim">{r.url}</div>
          </div>
        ))}
      </div>
      <div className="h-0.5 bg-border">
        <div className="h-full bg-accent w-full" style={{ animation: 'shrinkWidth 8s linear forwards' }} />
      </div>
    </div>
  );
}

export default function SearchResultPopup() {
  const searchResults = usePepperStore((s) => s.searchResults);
  const dismissSearchResult = usePepperStore((s) => s.dismissSearchResult);

  if (searchResults.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-[150]">
      {searchResults.map((result) => (
        <SearchResultCard key={result.id} result={result} onDismiss={() => dismissSearchResult(result.id)} />
      ))}
    </div>
  );
}
