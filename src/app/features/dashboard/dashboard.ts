import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ExpensesApi } from '../../core/api/expenses-api';
import { ReportsApi } from '../../core/api/reports-api';
import { ApiError } from '../../core/http/api-error';
import { toApiError } from '../../core/http/api-error-interceptor';
import { Expense } from '../../core/models/expense';
import { paymentMethodLabel } from '../../core/models/payment-method';
import {
  BudgetStatus,
  BudgetStatusItem,
  SpendingSummary,
  SpendingTrend,
} from '../../core/models/report';
import { BarList, BarListItem } from '../../shared/charts/bar-list/bar-list';
import { BudgetMeter } from '../../shared/charts/budget-meter/budget-meter';
import { ColumnChart } from '../../shared/charts/column-chart/column-chart';
import { CategoryChip } from '../../shared/components/category-chip/category-chip';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ErrorBanner } from '../../shared/components/error-banner/error-banner';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { CalendarDatePipe } from '../../shared/pipes/calendar-date-pipe';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { withLocalProgress } from '../../shared/utils/budget-progress';
import {
  DateRange,
  formatMonth,
  formatRange,
  monthOf,
  monthRange,
  todayIso,
} from '../../shared/utils/dates';
import { formatMoney, formatPercent } from '../../shared/utils/money';

const MAX_BUDGETS = 5;

const RECENT_COUNT = 5;

const CATEGORY_ROWS = 6;

interface DashboardData {
  summary: SpendingSummary;
  trend: SpendingTrend;
  budgets: BudgetStatus;
  daysElapsed: number;
  spentSoFar: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    BarList,
    BudgetMeter,
    CalendarDatePipe,
    CategoryChip,
    ColumnChart,
    EmptyState,
    ErrorBanner,
    Icon,
    MoneyPipe,
    PageHeader,
    RouterLink,
    StatTile,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly reportsApi = inject(ReportsApi);
  private readonly expensesApi = inject(ExpensesApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly newExpenseParams = { new: 1 };
  protected readonly categoryRows = CATEGORY_ROWS;

  protected readonly data = signal<DashboardData | null>(null);
  protected readonly initialLoad = computed(() => this.data() === null);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly recent = signal<Expense[] | null>(null);
  protected readonly recentError = signal<ApiError | null>(null);

  protected readonly range = signal<DateRange>(monthRange(monthOf(todayIso())));
  protected readonly monthName = computed(() => formatMonth(monthOf(this.range().from)));

  protected readonly rangeLabel = computed(() => {
    const summary = this.data()?.summary;
    return summary ? formatRange({ from: summary.from, to: summary.to }) : '';
  });

  protected readonly dailyAverage = computed(() => {
    const data = this.data();
    return data && data.daysElapsed > 0 ? data.spentSoFar / data.daysElapsed : 0;
  });

  protected readonly dailyAverageHint = computed(() => {
    const days = this.data()?.daysElapsed ?? 0;
    return days === 1 ? 'Over 1 day so far' : `Over all ${days} days so far`;
  });

  protected readonly expenseCount = computed(() =>
    (this.data()?.summary.expenseCount ?? 0).toLocaleString(),
  );

  protected readonly expenseCountHint = computed(() => {
    const summary = this.data()?.summary;

    if (!summary || summary.expenseCount === 0) {
      return 'None recorded yet';
    }

    const categories = summary.byCategory.length;
    return categories === 1 ? 'In 1 category' : `In ${categories} categories`;
  });

  protected readonly largestExpenseHint = computed(() => {
    const summary = this.data()?.summary;

    if (!summary || summary.total <= 0) {
      return 'Nothing spent yet';
    }

    const share = Math.round((summary.largestExpense / summary.total) * 1000) / 10;
    return `${formatPercent(share)} of this month's total`;
  });

  protected readonly categoryItems = computed<BarListItem[]>(() =>
    (this.data()?.summary.byCategory ?? []).map((item) => ({
      key: item.categoryId,
      label: item.categoryName,
      value: item.total,
      percent: item.percentOfTotal,
      detail: expensesLabel(item.count),
      swatchColor: item.colorHex,
    })),
  );

  protected readonly paymentItems = computed<BarListItem[]>(() =>
    (this.data()?.summary.byPaymentMethod ?? []).map((item) => ({
      key: item.paymentMethod,
      label: paymentMethodLabel(item.paymentMethod),
      value: item.total,
      percent: item.percentOfTotal,
      detail: expensesLabel(item.count),
    })),
  );

  protected readonly budgeted = computed(() =>
    (this.data()?.budgets.categories ?? []).filter((item) => item.limit !== null).sort(byRisk),
  );

  protected readonly topBudgets = computed(() => this.budgeted().slice(0, MAX_BUDGETS));
  protected readonly moreBudgets = computed(() => Math.max(0, this.budgeted().length - MAX_BUDGETS));

  protected readonly budgetSummary = computed(() => {
    const status = this.data()?.budgets;

    if (!status) {
      return '';
    }

    const spent = this.budgeted().reduce((sum, item) => sum + item.spent, 0);
    const parts = [
      `${formatMoney(spent, status.currency)} spent of ${formatMoney(status.totalLimit, status.currency)} budgeted`,
    ];

    const daysLeft = daysLeftLabel(status);

    if (daysLeft) {
      parts.push(daysLeft);
    }

    return parts.join(' · ');
  });

  protected readonly unbudgetedSpent = computed(() =>
    (this.data()?.budgets.categories ?? [])
      .filter((item) => item.limit === null)
      .reduce((sum, item) => sum + item.spent, 0),
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    const today = todayIso();
    const month = monthOf(today);
    const range = monthRange(month);

    this.range.set(range);
    this.refreshing.set(true);
    this.error.set(null);
    this.loadRecent();

    forkJoin({
      summary: this.reportsApi.summary(range),
      trend: this.reportsApi.trend('Daily', range),
      budgets: this.reportsApi.budgetStatus(month),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ summary, trend, budgets }) => {
          this.data.set({
            summary,
            trend,
            budgets: withLocalProgress(budgets, today),
            daysElapsed: Number(today.slice(8, 10)),
            spentSoFar: trend.points
              .filter((point) => point.periodStart <= today)
              .reduce((sum, point) => sum + point.total, 0),
          });
          this.refreshing.set(false);
        },
        error: (error: unknown) => {
          this.error.set(toApiError(error));
          this.refreshing.set(false);
        },
      });
  }

  protected loadRecent(): void {
    this.recentError.set(null);

    this.expensesApi
      .list({ pageSize: RECENT_COUNT, sort: 'CreatedAtDesc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.recent.set(page.items),
        error: (error: unknown) => this.recentError.set(toApiError(error)),
      });
  }
}

function byRisk(a: BudgetStatusItem, b: BudgetStatusItem): number {
  if (a.isOverBudget !== b.isOverBudget) {
    return a.isOverBudget ? -1 : 1;
  }

  return (
    (b.percentUsed ?? 0) - (a.percentUsed ?? 0) ||
    b.spent - a.spent ||
    a.categoryName.localeCompare(b.categoryName)
  );
}

function daysLeftLabel(status: BudgetStatus): string | null {
  if (!status.isCurrentMonth) {
    return null;
  }

  const left = status.daysInMonth - status.daysElapsed;

  if (left <= 0) {
    return 'last day of the month';
  }

  return left === 1 ? '1 day to go' : `${left} days to go`;
}

function expensesLabel(count: number): string {
  return count === 1 ? '1 expense' : `${count} expenses`;
}
