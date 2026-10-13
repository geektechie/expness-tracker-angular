import { formatMoney, formatPercent } from './money';

function digits(text: string): string {
  return text.replace(/\D/g, '');
}

describe('formatMoney', () => {
  it('shows a dash for a missing amount', () => {
    expect(formatMoney(null, 'USD')).toBe('—');
    expect(formatMoney(undefined, 'USD')).toBe('—');
    expect(formatMoney(Number.NaN, 'USD')).toBe('—');
  });

  it('always shows two decimal places in the standard style', () => {
    expect(digits(formatMoney(12, 'USD'))).toBe('1200');
    expect(digits(formatMoney(12.5, 'USD'))).toBe('1250');
    expect(digits(formatMoney(1234.56, 'USD'))).toBe('123456');
  });

  it('rounds to the cent', () => {
    expect(digits(formatMoney(0.1 + 0.2, 'USD'))).toBe('030');
    expect(digits(formatMoney(19.999, 'USD'))).toBe('2000');
    expect(digits(formatMoney(0.125, 'USD'))).toBe('013');
  });

  it('keeps a formatter per currency', () => {
    expect(formatMoney(5, 'USD')).not.toBe(formatMoney(5, 'EUR'));
    expect(formatMoney(5, 'USD')).toBe(formatMoney(5, 'USD'));
  });

  it('falls back to USD when the currency is unknown to the caller', () => {
    expect(formatMoney(5, '')).toBe(formatMoney(5, 'USD'));
  });

  it('keeps cents in compact labels, so small axis ticks stay distinct', () => {
    const labels = [0, 0.02, 0.04, 0.06, 0.1].map((value) => formatMoney(value, 'USD', 'compact'));

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('shortens large compact amounts', () => {
    expect(formatMoney(1_500_000, 'USD', 'compact').length).toBeLessThan(
      formatMoney(1_500_000, 'USD').length,
    );
  });
});

describe('formatPercent', () => {
  it('shows a dash for a missing share', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
  });

  it('keeps at most one decimal', () => {
    expect(digits(formatPercent(74.5))).toBe('745');
    expect(digits(formatPercent(33.333))).toBe('333');
    expect(formatPercent(50)).toMatch(/^50\s?%$/);
  });
});
