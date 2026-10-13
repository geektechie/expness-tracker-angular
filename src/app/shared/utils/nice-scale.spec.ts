import { formatMoney } from './money';
import { niceTicks } from './nice-scale';

const SAMPLE_MAXIMA = [
  0.01, 0.02, 0.03, 0.05, 0.08, 0.2, 0.3, 0.4, 1, 4, 7.5, 90, 100, 350, 400, 999.99, 1000, 1500,
  7000, 25_000, 1_234_567,
];

describe('niceTicks', () => {
  it('gives a lone zero tick for no data', () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(-5)).toEqual([0]);
    expect(niceTicks(Number.NaN)).toEqual([0]);
    expect(niceTicks(Number.POSITIVE_INFINITY)).toEqual([0]);
  });

  it('steps by 1, 2 or 5 times a power of ten', () => {
    expect(niceTicks(90)).toEqual([0, 50, 100]);
    expect(niceTicks(350)).toEqual([0, 100, 200, 300, 400]);
    expect(niceTicks(7.5)).toEqual([0, 2, 4, 6, 8]);
  });

  it('extends past a max that is an exact multiple of the step', () => {
    expect(niceTicks(100)).toEqual([0, 50, 100, 150]);
    expect(niceTicks(400)).toEqual([0, 100, 200, 300, 400, 500]);
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(niceTicks(0.3)).toEqual([0, 0.1, 0.2, 0.3, 0.4]);
  });

  it('never steps below a cent', () => {
    expect(niceTicks(0.01)).toEqual([0, 0.01, 0.02]);
    expect(niceTicks(0.02)).toEqual([0, 0.01, 0.02, 0.03]);
  });

  for (const max of SAMPLE_MAXIMA) {
    it(`covers ${max} with evenly spaced, clean ticks above it`, () => {
      const ticks = niceTicks(max);
      const step = ticks[1] - ticks[0];

      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBeGreaterThan(max);
      expect(ticks[ticks.length - 2]).toBeLessThanOrEqual(max);

      ticks.forEach((tick, index) => {
        expect(tick).toBeCloseTo(index * step, 10);

        expect(String(tick).length).toBeLessThan(12);
      });
    });

    it(`labels every tick for ${max} differently in compact money`, () => {
      const labels = niceTicks(max).map((tick) => formatMoney(tick, 'USD', 'compact'));

      expect(new Set(labels).size).toBe(labels.length);
    });
  }
});
