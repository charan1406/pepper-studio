import React from 'react';

const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-active shadow-[0_1px_8px_rgba(124,124,240,0.35)]',
  secondary: 'bg-surface-2 text-text border border-border hover:border-border-strong',
  ghost: 'text-muted hover:text-text hover:bg-surface-2',
  danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
};

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={
        'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium ' +
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ' +
        'disabled:opacity-50 disabled:pointer-events-none ' +
        (VARIANTS[variant] ?? VARIANTS.primary) + ' ' + className
      }
      {...props}
    />
  );
}
