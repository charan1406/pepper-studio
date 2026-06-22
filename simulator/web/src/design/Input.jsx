import React, { useId } from 'react';

export function Input({ label, className = '', id, ...props }) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-xs text-muted tracking-wide">{label}</label>
      )}
      <input
        id={fieldId}
        className={
          'rounded-md bg-surface-1 border border-border px-3.5 py-2.5 text-sm text-text ' +
          'placeholder:text-dim focus:outline-none focus:border-accent/60 focus:ring-[3px] focus:ring-accent-soft ' +
          className
        }
        {...props}
      />
    </div>
  );
}
