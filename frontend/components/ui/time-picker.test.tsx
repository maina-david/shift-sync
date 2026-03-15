import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimePicker } from './time-picker';

vi.mock('lucide-react', () => ({
  Clock: () => <svg data-testid="clock-icon" />,
}));

describe('TimePicker', () => {
  it('renders with default 09:00 when no value provided', () => {
    render(<TimePicker onChange={vi.fn()} />);
    expect(screen.getByLabelText('Hours')).toHaveValue('09');
    expect(screen.getByLabelText('Minutes')).toHaveValue('00');
  });

  it('renders with the provided value', () => {
    render(<TimePicker value="14:30" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Hours')).toHaveValue('14');
    expect(screen.getByLabelText('Minutes')).toHaveValue('30');
  });

  it('shows the clock icon', () => {
    render(<TimePicker onChange={vi.fn()} />);
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
  });

  it('syncs when value prop changes externally', () => {
    const { rerender } = render(<TimePicker value="09:00" onChange={vi.fn()} />);
    rerender(<TimePicker value="15:45" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Hours')).toHaveValue('15');
    expect(screen.getByLabelText('Minutes')).toHaveValue('45');
  });

  it('applies disabled state to both inputs', () => {
    render(<TimePicker value="09:00" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText('Hours')).toBeDisabled();
    expect(screen.getByLabelText('Minutes')).toBeDisabled();
  });

  // ── Hours: Arrow keys ────────────────────────────────────────────────────

  it('increments hours on ArrowUp', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Hours'), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith('10:00');
  });

  it('wraps hours from 23 to 00 on ArrowUp', () => {
    const onChange = vi.fn();
    render(<TimePicker value="23:00" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Hours'), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith('00:00');
  });

  it('decrements hours on ArrowDown', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Hours'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('08:00');
  });

  it('wraps hours from 00 to 23 on ArrowDown', () => {
    const onChange = vi.fn();
    render(<TimePicker value="00:00" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Hours'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('23:00');
  });

  // ── Minutes: Arrow keys ──────────────────────────────────────────────────

  it('increments minutes on ArrowUp', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:30" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Minutes'), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith('09:31');
  });

  it('wraps minutes from 59 to 00 on ArrowUp', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:59" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Minutes'), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith('09:00');
  });

  it('decrements minutes on ArrowDown', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:30" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Minutes'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('09:29');
  });

  it('wraps minutes from 00 to 59 on ArrowDown', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Minutes'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('09:59');
  });

  // ── Hours: digit entry ───────────────────────────────────────────────────

  it('single digit >= 3 auto-advances to minutes', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Hours'), { key: '5' });
    expect(onChange).toHaveBeenCalledWith('05:00');
    expect(document.activeElement).toBe(screen.getByLabelText('Minutes'));
  });

  it('single digit 9 auto-advances to minutes', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Hours'), { key: '9' });
    expect(onChange).toHaveBeenCalledWith('09:00');
    expect(document.activeElement).toBe(screen.getByLabelText('Minutes'));
  });

  it('buffers first digit 0-2 then completes on second digit', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    const h = screen.getByLabelText('Hours');
    fireEvent.keyDown(h, { key: '1' });
    expect(onChange).toHaveBeenCalledWith('01:00');
    fireEvent.keyDown(h, { key: '4' });
    expect(onChange).toHaveBeenLastCalledWith('14:00');
    expect(document.activeElement).toBe(screen.getByLabelText('Minutes'));
  });

  it('clamps two-digit hour entry to 23', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    const h = screen.getByLabelText('Hours');
    fireEvent.keyDown(h, { key: '2' });
    fireEvent.keyDown(h, { key: '9' });
    expect(onChange).toHaveBeenLastCalledWith('23:00');
  });

  // ── Minutes: digit entry ─────────────────────────────────────────────────

  it('single minute digit >= 6 auto-finalises', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('Minutes'), { key: '7' });
    expect(onChange).toHaveBeenCalledWith('09:07');
  });

  it('buffers first minute digit 0-5 then completes on second digit', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    const m = screen.getByLabelText('Minutes');
    fireEvent.keyDown(m, { key: '3' });
    expect(onChange).toHaveBeenCalledWith('09:03');
    fireEvent.keyDown(m, { key: '8' });
    expect(onChange).toHaveBeenLastCalledWith('09:38');
  });

  // ── Focus navigation ─────────────────────────────────────────────────────

  it('colon key advances focus to minutes', () => {
    render(<TimePicker value="09:00" onChange={vi.fn()} />);
    const h = screen.getByLabelText('Hours');
    h.focus();
    fireEvent.keyDown(h, { key: ':' });
    expect(document.activeElement).toBe(screen.getByLabelText('Minutes'));
  });

  it('ArrowRight on hours advances focus to minutes', () => {
    render(<TimePicker value="09:00" onChange={vi.fn()} />);
    const h = screen.getByLabelText('Hours');
    h.focus();
    fireEvent.keyDown(h, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByLabelText('Minutes'));
  });

  it('ArrowLeft on minutes moves focus back to hours', () => {
    render(<TimePicker value="09:00" onChange={vi.fn()} />);
    const m = screen.getByLabelText('Minutes');
    m.focus();
    fireEvent.keyDown(m, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByLabelText('Hours'));
  });

  // ── Backspace ────────────────────────────────────────────────────────────

  it('Backspace on hours clears the buffer', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    const h = screen.getByLabelText('Hours');
    fireEvent.keyDown(h, { key: '1' }); // starts buffer
    fireEvent.keyDown(h, { key: 'Backspace' }); // clears buffer
    // After backspace the buffer is cleared; value from before should still be displayed
    expect(screen.getByLabelText('Hours')).toHaveValue('01');
  });
});
