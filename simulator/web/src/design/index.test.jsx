import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button, Input, Panel, Select, SegmentedToggle, Switch, Tabs } from './index';

describe('design barrel', () => {
  it('exports all primitives and they render together', () => {
    expect(() => render(
      <div>
        <Button>b</Button>
        <Input label="l" value="" onChange={() => {}} />
        <Panel title="p">x</Panel>
        <Select value="a" onValueChange={() => {}} options={[{ value: 'a', label: 'a' }]} ariaLabel="s" />
        <SegmentedToggle value="x" onValueChange={() => {}} options={[{ value: 'x', label: 'X' }]} />
        <Switch checked={false} onCheckedChange={() => {}} aria-label="sw" />
        <Tabs defaultValue="t" tabs={[{ value: 't', label: 'T', content: 'c' }]} />
      </div>
    )).not.toThrow();
  });
});
