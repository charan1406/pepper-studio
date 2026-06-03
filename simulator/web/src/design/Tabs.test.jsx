import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

const TABS = [
  { value: 'cam', label: 'Camera', content: <p>camera body</p> },
  { value: 'mon', label: 'Monitor', content: <p>monitor body</p> },
];

describe('Tabs', () => {
  it('shows the first tab by default and switches on click', async () => {
    const user = userEvent.setup();
    render(<Tabs defaultValue="cam" tabs={TABS} />);
    expect(screen.getByText('camera body')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Monitor' }));
    expect(screen.getByText('monitor body')).toBeTruthy();
    expect(screen.queryByText('camera body')).toBeNull();
  });
});
