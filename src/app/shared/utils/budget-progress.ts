import { BudgetStatus } from '../../core/models/report';
import { monthOf, todayIso } from './dates';

function roundMoney(value: number): number {
  return Math.round(Number((value * 100).toFixed(6))) / 100;
}

export function withLocalProgress(status: BudgetStatus, today: string = todayIso()): BudgetStatus {
  const currentMonth = monthOf(today);
  const isCurrentMonth = status.month === currentMonth;

  const daysElapsed = isCurrentMonth
    ? Number(today.slice(8, 10))
    : status.month > currentMonth
      ? 0
      : status.daysInMonth;

  const sameBasis = status.isCurrentMonth === isCurrentMonth && status.daysElapsed === daysElapsed;

  return {
    ...status,
    isCurrentMonth,
    daysElapsed,
    categories: sameBasis
      ? status.categories
      : status.categories.map((item) => ({
          ...item,

          projectedSpend:
            isCurrentMonth && daysElapsed > 0
              ? roundMoney((item.spent / daysElapsed) * status.daysInMonth)
              : null,
        })),
  };
}
