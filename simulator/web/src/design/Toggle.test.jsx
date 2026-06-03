import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedToggle, Switch } from './Toggle';

describe('SegmentedToggle', () => {
  it('renders options and fires onValueChange on selection', () => {
    const onChange = vi.fn();
    render(<SegmentedToggle value="sim" onValueChange={onChange}
      options={[{ value: 'sim', label: 'Sim' }, { value: 'real', label: 'Real' }]} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Real' }));
    expect(onChange).toHaveBeenCalledWith('real');
  });

  it('does not fire onValueChange when the active option is re-clicked', () => {
    const onChange = vi.fn();
    render(<SegmentedToggle value="sim" onValueChange={onChange}
      options={[{ value: 'sim', label: 'Sim' }, { value: 'real', label: 'Real' }]} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Switch', () => {
  it('toggles and fires onCheckedChange', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} aria-label="awareness" />);
    fireEvent.click(screen.getByRole('switch', { name: 'awareness' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
