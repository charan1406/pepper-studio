import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Onboarding from './Onboarding';
import { usePepperStore } from '../hooks/usePepperState';

beforeEach(() => {
  localStorage.clear();
  usePepperStore.setState({ aiPanelOpen: false, aiInitialSource: null });
});

describe('Onboarding', () => {
  it('shows on first run, hidden once seen', () => {
    localStorage.setItem('pepper_onboarded', '1');
    const { container } = render(<Onboarding />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Set up AI opens the AI panel and marks onboarding seen', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByRole('button', { name: /set up ai/i }));
    expect(usePepperStore.getState().aiPanelOpen).toBe(true);
    expect(localStorage.getItem('pepper_onboarded')).toBe('1');
  });

  it('a source link deep-links to that source', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByRole('button', { name: /local gguf/i }));
    expect(usePepperStore.getState().aiInitialSource).toBe('gguf');
    expect(usePepperStore.getState().aiPanelOpen).toBe(true);
  });

  it('Skip dismisses without opening AI', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(usePepperStore.getState().aiPanelOpen).toBe(false);
    expect(localStorage.getItem('pepper_onboarded')).toBe('1');
  });
});
