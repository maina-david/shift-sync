import { describe, it, expect } from 'vitest';
import { cn, safeFormat, parseTimeMinutes } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('handles conditional classes', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('deduplicates conflicting tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles undefined and null entries', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });

  it('handles arrays', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  it('returns empty string when no classes given', () => {
    expect(cn()).toBe('');
  });
});

describe('safeFormat', () => {
  it('formats a valid ISO date string', () => {
    expect(safeFormat('2026-03-15', 'yyyy-MM-dd')).toBe('2026-03-15');
  });

  it('formats a Date object', () => {
    expect(safeFormat(new Date('2026-01-01T00:00:00Z'), 'yyyy')).toBe('2026');
  });

  it('returns default fallback for null', () => {
    expect(safeFormat(null, 'yyyy-MM-dd')).toBe('—');
  });

  it('returns default fallback for undefined', () => {
    expect(safeFormat(undefined, 'yyyy-MM-dd')).toBe('—');
  });

  it('returns default fallback for empty string', () => {
    expect(safeFormat('', 'yyyy-MM-dd')).toBe('—');
  });

  it('returns default fallback for invalid date string', () => {
    expect(safeFormat('not-a-date', 'yyyy-MM-dd')).toBe('—');
  });

  it('returns custom fallback', () => {
    expect(safeFormat(null, 'yyyy-MM-dd', 'N/A')).toBe('N/A');
  });

  it('formats time components', () => {
    expect(safeFormat('2026-03-15T14:30:00Z', 'HH:mm')).toMatch(/\d{2}:\d{2}/);
  });
});

describe('parseTimeMinutes', () => {
  it('parses "09:30" correctly', () => {
    expect(parseTimeMinutes('09:30')).toBe(570);
  });

  it('parses "00:00" as 0', () => {
    expect(parseTimeMinutes('00:00')).toBe(0);
  });

  it('parses "23:59" correctly', () => {
    expect(parseTimeMinutes('23:59')).toBe(23 * 60 + 59);
  });

  it('parses "18:00" correctly', () => {
    expect(parseTimeMinutes('18:00')).toBe(1080);
  });

  it('returns null for null', () => {
    expect(parseTimeMinutes(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseTimeMinutes(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseTimeMinutes('')).toBeNull();
  });

  it('returns null for string with no colon', () => {
    expect(parseTimeMinutes('1200')).toBeNull();
  });

  it('returns null for non-numeric segments', () => {
    expect(parseTimeMinutes('ab:cd')).toBeNull();
  });
});
