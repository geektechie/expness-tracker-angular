import { BudgetStatus, BudgetStatusItem } from '../../core/models/report';
import { withLocalProgress } from './budget-progress';

function item(spent: number, projectedSpend: number | null): BudgetStatusItem {
  return {
    categoryId: 'food',
    categoryName: 'Food',
    colorHex: '#22aa66',
    limit: 100,
    spent,
    remaining: 100 - spent,
    percentUsed: spent,
    isOverBudget: spent > 100,
    projectedSpend,
  };
}

function status(overrides: Partial<BudgetStatus>): BudgetStatus {
  return {
    month: '2026-10',
    currency: 'USD',
    totalLimit: 100,
    totalSpent: 30,
    totalRemaining: 70,
    daysInMonth: 31,
    daysElapsed: 10,
    isCurrentMonth: true,
    categories: [item(30, 93)],
    ...overrides,
  };
}

describe('withLocalProgress', () => {
  it("keeps the API's projection when the local day matches the server's", () => {
    const server = status({ categories: [item(30, 93.01)] });
    const result = withLocalProgress(server, '2026-10-10');

    expect(result.daysElapsed).toBe(10);
    expect(result.isCurrentMonth).toBeTrue();
    expect(result.categories[0].projectedSpend).toBe(93.01);
  });

  it('re-projects once the local day has moved past the server day', () => {
    const result = withLocalProgress(status({}), '2026-10-12');

    expect(result.daysElapsed).toBe(12);
    expect(result.categories[0].projectedSpend).toBe(77.5);
  });

  it('rounds a half cent up, as the API does, despite binary error', () => {
    const server = status({
      month: '2028-02',
      daysInMonth: 29,
      daysElapsed: 1,
      categories: [item(0.01, 0.29)],
    });

    expect(withLocalProgress(server, '2028-02-02').categories[0].projectedSpend).toBe(0.15);
  });

  it('treats a month the server still saw as current as finished once the local month moves on', () => {
    const result = withLocalProgress(status({}), '2026-11-01');

    expect(result.isCurrentMonth).toBeFalse();
    expect(result.daysElapsed).toBe(31);
    expect(result.categories[0].projectedSpend).toBeNull();
  });

  it('gives a future month no elapsed days and no projection', () => {
    const server = status({
      month: '2026-11',
      daysInMonth: 30,
      daysElapsed: 1,
      categories: [item(0, 0)],
    });
    const result = withLocalProgress(server, '2026-10-31');

    expect(result.isCurrentMonth).toBeFalse();
    expect(result.daysElapsed).toBe(0);
    expect(result.categories[0].projectedSpend).toBeNull();
  });

  it('leaves the totals untouched', () => {
    const result = withLocalProgress(status({}), '2026-10-12');

    expect(result.totalSpent).toBe(30);
    expect(result.totalLimit).toBe(100);
    expect(result.month).toBe('2026-10');
  });
});
