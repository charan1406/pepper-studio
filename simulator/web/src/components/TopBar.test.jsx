import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TopBar from './TopBar';
import { usePepperStore } from '../hooks/usePepperState';

beforeEach(() => {
  usePepperStore.setState({ connected: false, battery: 100, posture: 'StandInit', isMoving: false, mode: 'sim' });
});

describe('TopBar', () => {
  it('reflects live store state in the status chips', () => {
    usePepperStore.setState({ connected: true, battery: 42, posture: 'Crouch' });
    render(<TopBar />);
    expect(screen.getByText(/Connected/)).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('Crouch')).toBeInTheDocument();
  });

  it('shows Offline when disconnected', () => {
    render(<TopBar />);
    expect(screen.getByText(/Offline/)).toBeInTheDocument();
  });

  it('switching to Real Robot updates the store mode', () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole('radio', { name: /real robot/i }));
    expect(usePepperStore.getState().mode).toBe('real');
  });
});
