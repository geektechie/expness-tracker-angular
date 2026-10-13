import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, forkJoin, of, switchMap, tap } from 'rxjs';
import { ReportsApi } from '../../core/api/reports-api';
import { ApiError } from '../../core/http/api-error';
import { toApiError } from '../../core/http/api-error-interceptor';
import { paymentMethodLabel } from '../../core/models/payment-method';
import { SpendingSummary, SpendingTrend, TrendGranularity } from '../../core/models/report';
import { BarList, BarListItem } from '../../shared/charts/bar-list/bar-list';
import { ColumnChart } from '../../shared/charts/column-chart/column-chart';
import { DateRangeFilter } from '../../shared/components/date-range-filter/date-range-filter';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ErrorBanner } from '../../shared/components/error-banner/error-banner';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import {
  DATE_PRESETS,
  DateRange,
  addDays,
  dayCount,
  formatDayShort,
  formatMonth,
  formatRange,
  monthOf,
  monthRange,
  parseIsoDate,
  toIsoDate,
  todayIso,
} from '../../shared/utils/dates';
import { formatPercent } from '../../shared/utils/money';

const DAILY_MAX_DAYS = 92;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface ReportData {
  summary: SpendingSummary;
  trend: SpendingTrend;
}

interface GranularityChoice {
  range: DateRange;
  granularity: TrendGranularity;
}

interface ReportQuery {
  from: string;
  to: string;
  granularity: TrendGranularity;
  attempt: number;
}

@Component({
  selector: 'app-reports',
  imports: [
    BarList,
    ColumnChart,
    DateRangeFilter,
    EmptyState,
    ErrorBanner,
    Icon,
    MoneyPipe,
    PageHeader,
    RouterLink,
    StatTile,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reports {
  readonly from = input<string | undefined>();
  readonly to = input<string | undefined>();

  private readonly api = inject(ReportsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly range = linkedSignal<DateRange>(() => {
    const from = validDate(this.from());
    const to = validDate(this.to());
    return from && to && from <= to ? { from, to } : defaultRange();
  });

  protected readonly dailyMaxDays = DAILY_MAX_DAYS;
  protected readonly dailyAvailable = computed(() => dayCount(this.range()) <= DAILY_MAX_DAYS);

  private readonly chosenGranularity = signal<GranularityChoice | null>(null);

  protected readonly granularity = computed<TrendGranularity>(() => {
    const range = this.range();
    const chosen = this.chosenGranularity();

    return chosen && chosen.range.from === range.from && chosen.range.to === range.to
      ? chosen.granularity
      : this.dailyAvailable()
        ? 'Daily'
        : 'Monthly';
  });

  private readonly attempt = signal(0);

  private readonly query = computed<ReportQuery>(
    () => ({
      from: this.range().from,
      to: this.range().to,
      granularity: this.granularity(),
      attempt: this.attempt(),
    }),
    { equal: sameQuery },
  );

  protected readonly report = signal<ReportData | null>(null);
  protected readonly initialLoad = computed(() => this.report() === null);
  protected readonly refreshing = signal(false);
  protected readonly summaryRefreshing = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  private lastSummaryKey: string | null = null;

  protected readonly newExpenseParams = { new: '1' };

  protected readonly rangeLabel = computed(() => {
    const summary = this.report()?.summary;
    return summary ? formatRange({ from: summary.from, to: summary.to }) : null;
  });
  protected readonly trendSubtitle = computed(() => {
    const trend = this.report()?.trend;

    if (!trend) {
      return '';
    }

    if (trend.granularity !== 'Monthly') {
      return 'Per day';
    }

    const partial = partialMonths({ from: trend.from, to: trend.to }).map(
      (piece) => `${formatMonth(monthOf(piece.from))} counts ${formatDays(piece)} only`,
    );

    return partial.length > 0 ? `Per month · ${partial.join('; ')}` : 'Per month';
  });

  protected readonly averageHint = computed(() => {
    const days = this.report()?.summary.dayCount;
    return days === undefined ? null : `Across ${days === 1 ? '1 day' : `${days} days`}`;
  });

  protected readonly countValue = computed(
    () => this.report()?.summary.expenseCount.toLocaleString() ?? '',
  );

  protected readonly countHint = computed(() => {
    const categories = this.report()?.summary.byCategory.length ?? 0;

    if (categories === 0) {
      return null;
    }

    return categories === 1 ? 'In 1 category' : `In ${categories} categories`;
  });

  protected readonly largestHint = computed(() => {
    const summary = this.report()?.summary;

    if (!summary || summary.total <= 0) {
      return null;
    }

    const share = Math.round((summary.largestExpense / summary.total) * 1000) / 10;
    return `${formatPercent(share)} of the total`;
  });

  protected readonly hasSpending = computed(() => (this.report()?.summary.expenseCount ?? 0) > 0);

  protected readonly categoryItems = computed<BarListItem[]>(() =>
    (this.report()?.summary.byCategory ?? []).map((item) => ({
      key: item.categoryId,
      label: item.categoryName,
      value: item.total,
      percent: item.percentOfTotal,
      detail: expensesLabel(item.count),
      swatchColor: item.colorHex,
    })),
  );

  protected readonly paymentMethodItems = computed<BarListItem[]>(() =>
    (this.report()?.summary.byPaymentMethod ?? []).map((item) => ({
      key: item.paymentMethod,
      label: paymentMethodLabel(item.paymentMethod),
      value: item.total,
      percent: item.percentOfTotal,
      detail: expensesLabel(item.count),
    })),
  );

  constructor() {
    toObservable(this.query)
      .pipe(
        tap(() => {
          this.refreshing.set(true);
          this.error.set(null);
        }),
        switchMap((query) => {
          const range = { from: query.from, to: query.to };

          const key = `${query.from}|${query.to}|${query.attempt}`;
          const current = this.report();
          const reuse = current !== null && this.lastSummaryKey === key;

          this.summaryRefreshing.set(!reuse);

          return forkJoin({
            summary: reuse ? of(current.summary) : this.api.summary(range),
            trend: this.api.trend(query.granularity, range),
          }).pipe(
            tap(() => (this.lastSummaryKey = key)),
            catchError((error: unknown) => {
              this.error.set(toApiError(error));
              this.refreshing.set(false);
              this.summaryRefreshing.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((report) => {
        this.report.set(report);
        this.refreshing.set(false);
        this.summaryRefreshing.set(false);
      });
  }

  protected retry(): void {
    this.attempt.update((attempt) => attempt + 1);
  }

  protected changeRange(range: DateRange): void {
    this.range.set(range);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: range.from, to: range.to },
      queryParamsHandling: 'merge',

      replaceUrl: true,
    });
  }

  protected chooseGranularity(granularity: TrendGranularity): void {
    this.chosenGranularity.set({ range: this.range(), granularity });
  }
}

function defaultRange(): DateRange {
  const preset = DATE_PRESETS.find((candidate) => candidate.id === 'last-30');
  return preset ? preset.range() : { from: addDays(todayIso(), -29), to: todayIso() };
}

function validDate(value: string | undefined): string {
  return value && ISO_DATE.test(value) && toIsoDate(parseIsoDate(value)) === value ? value : '';
}

function partialMonths(range: DateRange): DateRange[] {
  const first = monthRange(monthOf(range.from));
  const last = monthRange(monthOf(range.to));
  const pieces =
    first.from === last.from
      ? [range]
      : [
        { from: range.from, to: first.to },
        { from: last.from, to: range.to },
      ];

  return pieces.filter((piece) => {
    const month = monthRange(monthOf(piece.from));
    return piece.from !== month.from || piece.to !== month.to;
  });
}

function formatDays(range: DateRange): string {
  return range.from === range.to
    ? formatDayShort(range.from)
    : `${formatDayShort(range.from)} – ${formatDayShort(range.to)}`;
}

function sameQuery(a: ReportQuery, b: ReportQuery): boolean {
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.granularity === b.granularity &&
    a.attempt === b.attempt
  );
}

function expensesLabel(count: number): string {
  return count === 1 ? '1 expense' : `${count} expenses`;
}
