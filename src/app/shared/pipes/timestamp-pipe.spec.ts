import { formatTimestamp } from '../utils/dates';
import { TimestampPipe } from './timestamp-pipe';

describe('TimestampPipe', () => {
  const pipe = new TimestampPipe();

  it('formats an instant', () => {
    const instant = '2026-10-09T14:30:00Z';

    expect(pipe.transform(instant)).toBe(formatTimestamp(instant));
    expect(pipe.transform(instant)).toContain('2026');
  });

  it('renders nothing for a missing or unreadable instant', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform('not a time')).toBe('');
  });
});
