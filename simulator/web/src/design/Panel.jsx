import React from 'react';

const STATUS_TONE = {
  live: 'text-ok bg-ok/15',
  warn: 'text-warn bg-warn/15',
  off: 'text-dim bg-surface-2',
};

export function Panel({ title, status, statusTone = 'live', actions, className = '', children }) {
  return (
    <div className={'flex flex-col rounded-lg bg-surface-1 border border-border overflow-hidden ' + className}>
      {(title || status || actions) && (
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
          <span className="text-sm font-medium text-text">{title}</span>
          <div className="flex items-center gap-2">
            {status && (
              <span data-testid="panel-status"
                className={'text-[10px] px-2 py-0.5 rounded-full ' + (STATUS_TONE[statusTone] || STATUS_TONE.off)}>
                {status}
              </span>
            )}
            {actions}
          </div>
        </div>
      )}
      <div className="p-3.5 text-sm text-muted">{children}</div>
    </div>
  );
}
