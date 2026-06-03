import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const OPTS = [
  { value: 'StandInit', label: 'StandInit' },
  { value: 'Crouch', label: 'Crouch' },
];

describe('Select', () => {
  it('shows the current value', () => {
    render(<Select value="StandInit" onValueChange={() => {}} options={OPTS} ariaLabel="Posture" />);
    expect(screen.getByText('StandInit')).toBeTruthy();
  });

  it('opens and fires onValueChange on selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select value="StandInit" onValueChange={onChange} options={OPTS} ariaLabel="Posture" />);
    await user.click(screen.getByRole('combobox', { name: 'Posture' }));
    await user.click(await screen.findByRole('option', { name: 'Crouch' }));
    expect(onChange).toHaveBeenCalledWith('Crouch');
  });
});
