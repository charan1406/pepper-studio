import React from 'react';
import * as RTabs from '@radix-ui/react-tabs';

export function Tabs({ defaultValue, tabs, className = '' }) {
  return (
    <RTabs.Root defaultValue={defaultValue} className={'flex flex-col ' + className}>
      <RTabs.List className="flex gap-1 border-b border-border px-1">
        {tabs.map((t) => (
          <RTabs.Trigger key={t.value} value={t.value}
            className="px-3 py-2 text-sm text-muted data-[state=active]:text-text
                       data-[state=active]:border-b-2 data-[state=active]:border-accent -mb-px">
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {tabs.map((t) => (
        <RTabs.Content key={t.value} value={t.value} className="p-3.5">{t.content}</RTabs.Content>
      ))}
    </RTabs.Root>
  );
}
