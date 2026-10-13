import { formatDate, formatDayShort, formatMonth } from '../utils/dates';
import { CalendarDatePipe } from './calendar-date-pipe';

describe('CalendarDatePipe', () => {
  const pipe = new CalendarDatePipe();

  it('renders nothing for a missing date', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('formats a calendar date in each style', () => {
    expect(pipe.transform('2026-10-09')).toBe(formatDate('2026-10-09'));
    expect(pipe.transform('2026-10-09', 'short')).toBe(formatDayShort('2026-10-09'));
    expect(pipe.transform('2026-10-09', 'month')).toBe(formatMonth('2026-10'));
  });

  it('never shifts the day by reading the date as UTC', () => {
    expect(pipe.transform('2026-10-01')).toContain('1');
    expect(pipe.transform('2026-10-01')).not.toContain('30');
  });
});
