import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Panel } from './Panel';

describe('Panel', () => {
  it('renders title, status, and children', () => {
    render(<Panel title="Thoughts" status="live"><p>body text</p></Panel>);
    expect(screen.getByText('Thoughts')).toBeTruthy();
    expect(screen.getByText('live')).toBeTruthy();
    expect(screen.getByText('body text')).toBeTruthy();
  });

  it('omits the status pill when no status given', () => {
    render(<Panel title="Camera"><p>x</p></Panel>);
    expect(screen.queryByTestId('panel-status')).toBeNull();
  });
});
