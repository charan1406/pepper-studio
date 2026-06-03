import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders a label associated to the field', () => {
    render(<Input label="Bridge URL" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Bridge URL')).toBeTruthy();
  });

  it('fires onChange with typed value', () => {
    const onChange = vi.fn();
    render(<Input label="Say" value="" onChange={onChange} placeholder="Say something" />);
    fireEvent.change(screen.getByPlaceholderText('Say something'), { target: { value: 'hi' } });
    expect(onChange).toHaveBeenCalled();
  });
});
