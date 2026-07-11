import React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import * as RSwitch from '@radix-ui/react-switch';

export function SegmentedToggle({ value, onValueChange, options, ariaLabel }) {
  return (
    <ToggleGroup.Root
      type="single" value={value}
      onValueChange={(v) => { if (v) onValueChange(v); }}
      aria-label={ariaLabel}
      className="inline-flex bg-surface-1 border border-border-strong rounded-lg p-0.5"
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value} value={o.value}
          className="px-4 py-1.5 text-sm rounded-md text-text/70 hover:text-text data-[state=on]:bg-accent
                     data-[state=on]:text-on-accent data-[state=on]:font-medium data-[state=on]:shadow-[0_0_10px_rgba(52,216,200,0.28)]
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export function Switch({ className = '', ...props }) {
  return (
    <RSwitch.Root
      className={'w-9 h-5 rounded-full bg-surface-2 data-[state=checked]:bg-accent relative transition-colors ' + className}
      {...props}
    >
      <RSwitch.Thumb className="block w-4 h-4 bg-white rounded-full translate-x-0.5
        data-[state=checked]:translate-x-[18px] transition-transform" />
    </RSwitch.Root>
  );
}
