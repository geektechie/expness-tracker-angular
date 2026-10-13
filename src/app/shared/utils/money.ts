const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(
  value: number | null | undefined,
  currency: string,
  style: 'standard' | 'compact' = 'standard',
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  const key = `${currency}|${style}`;
  let cached = moneyFormatters.get(key);

  if (!cached) {
    cached = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',

      ...(style === 'compact'
        ? { notation: 'compact', maximumFractionDigits: 2 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
    moneyFormatters.set(key, cached);
  }

  return cached.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}
