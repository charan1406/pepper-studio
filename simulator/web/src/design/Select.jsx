import React from 'react';
import * as RSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

export function Select({ value, onValueChange, options, ariaLabel, className = '' }) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange}>
      <RSelect.Trigger
        aria-label={ariaLabel}
        className={'inline-flex items-center justify-between gap-2 rounded-md bg-surface-2 border border-border ' +
          'px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/60 ' + className}
      >
        <RSelect.Value />
        <RSelect.Icon><ChevronDown size={14} className="text-accent" /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper" sideOffset={6}
          className="rounded-md bg-overlay border border-border-strong p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-50"
        >
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item key={o.value} value={o.value}
                className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm text-text rounded-md
                           data-[highlighted]:bg-accent-soft data-[highlighted]:outline-none cursor-pointer">
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                <RSelect.ItemIndicator><Check size={14} className="text-accent" /></RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
