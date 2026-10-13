import {
  DATE_PRESETS,
  addDays,
  addMonths,
  currentMonth,
  dayCount,
  formatDate,
  formatRange,
  matchPreset,
  monthOf,
  monthRange,
  parseIsoDate,
  toIsoDate,
  todayIso,
  utcTodayIso,
} from './dates';

function presetRange(id: string) {
  const preset = DATE_PRESETS.find((candidate) => candidate.id === id);

  if (!preset) {
    throw new Error(`No preset ${id}`);
  }

  return preset.range();
}

describe('dates', () => {
  describe('parseIsoDate / toIsoDate', () => {
    it('reads yyyy-MM-dd as local midnight', () => {
      const date = parseIsoDate('2026-10-09');

      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(9);
      expect(date.getDate()).toBe(9);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
    });

    it('round-trips calendar dates', () => {
      for (const iso of ['2026-01-01', '2026-12-31', '2024-02-29', '1999-07-04']) {
        expect(toIsoDate(parseIsoDate(iso))).toBe(iso);
      }
    });

    it('keeps years 0000-0099 instead of mapping them to the 1900s', () => {
      expect(parseIsoDate('0026-10-12').getFullYear()).toBe(26);
      expect(toIsoDate(parseIsoDate('0026-10-12'))).toBe('0026-10-12');
      expect(addDays('0026-10-12', 1)).toBe('0026-10-13');
    });

    it('gives an invalid date for garbage, which formatting renders as empty', () => {
      expect(Number.isNaN(parseIsoDate('not-a-date').getTime())).toBeTrue();
      expect(formatDate('not-a-date')).toBe('');
    });
  });

  describe('addDays', () => {
    it('crosses month and year boundaries', () => {
      expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('knows leap years', () => {
      expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
      expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
      expect(addDays('2100-02-28', 1)).toBe('2100-03-01');
      expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
    });

    it('steps calendar days across a whole year, so DST changes never skip or repeat one', () => {
      let iso = '2026-01-01';

      for (let i = 0; i < 365; i++) {
        const next = addDays(iso, 1);

        expect(dayCount({ from: iso, to: next })).toBe(2);
        iso = next;
      }

      expect(iso).toBe('2027-01-01');
      expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
    });
  });

  describe('months', () => {
    it('steps months, rolling over the year both ways', () => {
      expect(addMonths('2026-12', 1)).toBe('2027-01');
      expect(addMonths('2026-01', -1)).toBe('2025-12');
      expect(addMonths('2026-10', -12)).toBe('2025-10');
      expect(addMonths('2026-10', 15)).toBe('2028-01');
    });

    it('gives each month its real last day', () => {
      expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
      expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
      expect(monthRange('1900-02').to).toBe('1900-02-28');
      expect(monthRange('2000-02').to).toBe('2000-02-29');
      expect(monthRange('2026-04').to).toBe('2026-04-30');
      expect(monthRange('2026-12').to).toBe('2026-12-31');
    });

    it('takes the month of a date', () => {
      expect(monthOf('2026-10-09')).toBe('2026-10');
    });
  });

  describe('dayCount', () => {
    it('counts both ends of the range', () => {
      expect(dayCount({ from: '2026-10-09', to: '2026-10-09' })).toBe(1);
      expect(dayCount({ from: '2026-10-01', to: '2026-10-31' })).toBe(31);
      expect(dayCount({ from: '2024-01-01', to: '2024-12-31' })).toBe(366);
    });
  });

  describe('formatRange', () => {
    it('shows a single day once', () => {
      expect(formatRange({ from: '2026-10-09', to: '2026-10-09' })).toBe(formatDate('2026-10-09'));
    });

    it('names both years only when they differ', () => {
      const sameYear = formatRange({ from: '2026-10-01', to: '2026-10-31' });
      const twoYears = formatRange({ from: '2025-12-01', to: '2026-01-31' });

      expect(sameYear.match(/2026/g)?.length).toBe(1);
      expect(twoYears).toContain('2025');
      expect(twoYears).toContain('2026');
    });
  });

  describe('today', () => {
    afterEach(() => jasmine.clock().uninstall());

    it('uses the local calendar', () => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 9, 7, 23, 30));

      expect(todayIso()).toBe('2026-10-07');
      expect(currentMonth()).toBe('2026-10');
    });

    it('gives the UTC calendar day as yyyy-MM-dd', () => {
      const now = new Date(Date.UTC(2026, 0, 5, 21, 30));
      jasmine.clock().install();
      jasmine.clock().mockDate(now);

      expect(utcTodayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(utcTodayIso()).toBe('2026-01-05');
    });
  });

  describe('presets', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    function today(year: number, monthIndex: number, day: number): void {
      jasmine.clock().mockDate(new Date(year, monthIndex, day, 12));
    }

    it('end every rolling preset today', () => {
      today(2026, 9, 12);

      expect(presetRange('last-7')).toEqual({ from: '2026-10-06', to: '2026-10-12' });
      expect(presetRange('last-30')).toEqual({ from: '2026-09-13', to: '2026-10-12' });
      expect(presetRange('last-90')).toEqual({ from: '2026-07-15', to: '2026-10-12' });
      expect(presetRange('this-month')).toEqual({ from: '2026-10-01', to: '2026-10-12' });
      expect(presetRange('year-to-date')).toEqual({ from: '2026-01-01', to: '2026-10-12' });
    });

    it('takes last month across the year boundary', () => {
      today(2027, 0, 15);

      expect(presetRange('last-month')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    });

    it('covers the exact number of days each rolling preset names', () => {
      today(2024, 2, 1);

      expect(dayCount(presetRange('last-7'))).toBe(7);
      expect(dayCount(presetRange('last-30'))).toBe(30);
      expect(dayCount(presetRange('last-90'))).toBe(90);
    });

    it('matches a range to its preset, and nothing to a custom range', () => {
      today(2026, 9, 12);

      expect(matchPreset(presetRange('last-month'))?.id).toBe('last-month');
      expect(matchPreset({ from: '2026-10-02', to: '2026-10-12' })).toBeUndefined();
    });
  });
});
