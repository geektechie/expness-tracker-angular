export interface DateRange {
  from: string;
  to: string;
}

export function toIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function localDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, monthIndex, day);
  date.setHours(0, 0, 0, 0);

  return date;
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);

  return localDate(year, (month ?? 1) - 1, day ?? 1);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function utcTodayIso(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');

  return `${now.getUTCFullYear()}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);

  return toIsoDate(date);
}

export function currentMonth(): string {
  return todayIso().slice(0, 7);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(month: string, count: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = localDate(year, monthNumber - 1 + count, 1);

  return toIsoDate(date).slice(0, 7);
}

export function monthRange(month: string): DateRange {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = localDate(year, monthNumber, 0).getDate();

  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function dayCount(range: DateRange): number {
  const millisecondsPerDay = 86_400_000;
  const from = parseIsoDate(range.from).getTime();
  const to = parseIsoDate(range.to).getTime();

  return Math.round((to - from) / millisecondsPerDay) + 1;
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let cached = dateFormatters.get(key);

  if (!cached) {
    cached = new Intl.DateTimeFormat(undefined, options);
    dateFormatters.set(key, cached);
  }

  return cached;
}

function formatValid(options: Intl.DateTimeFormatOptions, date: Date): string {
  return Number.isNaN(date.getTime()) ? '' : formatter(options).format(date);
}

export function formatDate(iso: string): string {
  return formatValid({ year: 'numeric', month: 'short', day: 'numeric' }, parseIsoDate(iso));
}

export function formatDayShort(iso: string): string {
  return formatValid({ month: 'short', day: 'numeric' }, parseIsoDate(iso));
}

export function formatMonth(month: string): string {
  return formatValid({ year: 'numeric', month: 'long' }, parseIsoDate(`${month}-01`));
}

export function formatMonthShort(month: string): string {
  return formatValid({ year: 'numeric', month: 'short' }, parseIsoDate(`${month}-01`));
}

export function formatTimestamp(instant: string): string {
  return formatValid({ year: 'numeric', month: 'short', day: 'numeric' }, new Date(instant));
}

export function formatRange(range: DateRange): string {
  if (range.from === range.to) {
    return formatDate(range.from);
  }

  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);

  return sameYear
    ? `${formatDayShort(range.from)} – ${formatDate(range.to)}`
    : `${formatDate(range.from)} – ${formatDate(range.to)}`;
}

export interface DatePreset {
  id: string;
  label: string;
  range: () => DateRange;
}

export const DATE_PRESETS: readonly DatePreset[] = [
  {
    id: 'last-7',
    label: 'Last 7 days',
    range: () => ({ from: addDays(todayIso(), -6), to: todayIso() }),
  },
  {
    id: 'last-30',
    label: 'Last 30 days',
    range: () => ({ from: addDays(todayIso(), -29), to: todayIso() }),
  },
  {
    id: 'this-month',
    label: 'This month',
    range: () => ({ from: monthRange(currentMonth()).from, to: todayIso() }),
  },
  {
    id: 'last-month',
    label: 'Last month',
    range: () => monthRange(addMonths(currentMonth(), -1)),
  },
  {
    id: 'last-90',
    label: 'Last 90 days',
    range: () => ({ from: addDays(todayIso(), -89), to: todayIso() }),
  },
  {
    id: 'year-to-date',
    label: 'Year to date',
    range: () => ({ from: `${todayIso().slice(0, 4)}-01-01`, to: todayIso() }),
  },
];

export function matchPreset(range: DateRange): DatePreset | undefined {
  return DATE_PRESETS.find((preset) => {
    const candidate = preset.range();
    return candidate.from === range.from && candidate.to === range.to;
  });
}
