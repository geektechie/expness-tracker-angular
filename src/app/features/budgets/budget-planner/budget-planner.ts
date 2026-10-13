import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  forkJoin,
  from,
  map,
  merge,
  mergeMap,
  of,
  switchMap,
  tap,
  toArray,
} from 'rxjs';
import { BudgetsApi } from '../../../core/api/budgets-api';
import { CategoriesApi } from '../../../core/api/categories-api';
import { ReportsApi } from '../../../core/api/reports-api';
import { ApiError } from '../../../core/http/api-error';
import { toApiError } from '../../../core/http/api-error-interceptor';
import { Budget } from '../../../core/models/budget';
import { Category } from '../../../core/models/category';
import { BudgetStatus, BudgetStatusItem } from '../../../core/models/report';
import { Notifications } from '../../../core/services/notifications';

import { BudgetMeter, NEAR_LIMIT_PERCENT } from '../../../shared/charts/budget-meter/budget-meter';
import { CategoryChip } from '../../../shared/components/category-chip/category-chip';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { Icon } from '../../../shared/components/icon/icon';
import { MonthPicker } from '../../../shared/components/month-picker/month-picker';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { StatTile } from '../../../shared/components/stat-tile/stat-tile';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { withLocalProgress } from '../../../shared/utils/budget-progress';
import { addMonths, currentMonth, formatMonth } from '../../../shared/utils/dates';
import { formatMoney } from '../../../shared/utils/money';
import { BudgetForm } from '../budget-form/budget-form';

interface MonthData {

  month: string;
  status: BudgetStatus;
  budgets: Budget[];

  categories: Category[];

  previous: Budget[];
}

interface BudgetRow {
  budget: Budget;
  item: BudgetStatusItem;
}

interface PartialCopy {
  month: string;
  categoryIds: ReadonlySet<string>;
}

interface CopyOutcome {
  categoryId: string;
  error: ApiError | null;
}

const COPY_CONCURRENCY = 4;

@Component({
  selector: 'app-budget-planner',
  imports: [
    BudgetForm,
    BudgetMeter,
    CategoryChip,
    ConfirmDialog,
    EmptyState,
    ErrorBanner,
    Icon,
    MoneyPipe,
    MonthPicker,
    PageHeader,
    RouterLink,
    StatTile,
  ],
  templateUrl: './budget-planner.html',
  styleUrl: './budget-planner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetPlanner {
  private readonly budgetsApi = inject(BudgetsApi);
  private readonly categoriesApi = inject(CategoriesApi);
  private readonly reportsApi = inject(ReportsApi);
  private readonly notifications = inject(Notifications);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  private readonly copyButton = viewChild<ElementRef<HTMLButtonElement>>('copyButton');

  protected readonly month = signal(currentMonth());

  protected readonly data = signal<MonthData | null>(null);

  protected readonly initialLoad = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Budget | null>(null);
  protected readonly presetCategoryId = signal<string | null>(null);

  protected readonly pendingRemove = signal<Budget | null>(null);
  protected readonly removing = signal(false);

  protected readonly copying = signal(false);

  private readonly partialCopy = signal<PartialCopy | null>(null);
  private focusAfterCopy = false;

  private readonly reloads = new Subject<void>();

  protected readonly current = computed(() => {
    const data = this.data();
    return data && data.month === this.month() ? data : null;
  });

  protected readonly canSetBudget = computed(() => (this.current()?.categories.length ?? 0) > 0);

  protected readonly monthLabel = computed(() => {
    const data = this.data();
    return data ? formatMonth(data.month) : '';
  });

  private readonly activeIds = computed(
    () => new Set((this.data()?.categories ?? []).map((category) => category.id)),
  );

  protected readonly budgetRows = computed<BudgetRow[]>(() => {
    const data = this.data();

    if (!data) {
      return [];
    }

    const itemsById = new Map(
      data.status.categories.map((item) => [item.categoryId, item] as const),
    );

    return data.budgets
      .map((budget) => ({
        budget,
        item: itemsById.get(budget.categoryId) ?? emptyItemFor(budget),
      }))
      .sort(
        (a, b) =>
          riskTier(a.item) - riskTier(b.item) ||
          (b.item.percentUsed ?? 0) - (a.item.percentUsed ?? 0) ||
          a.budget.categoryName.localeCompare(b.budget.categoryName),
      );
  });

  protected readonly unbudgetedSpending = computed(
    () => this.data()?.status.categories.filter((item) => item.limit === null) ?? [],
  );

  protected readonly notBudgeted = computed(() => {
    const data = this.data();

    if (!data) {
      return [];
    }

    const seen = new Set([
      ...data.budgets.map((budget) => budget.categoryId),
      ...data.status.categories.map((item) => item.categoryId),
    ]);

    return data.categories.filter((category) => !seen.has(category.id));
  });

  protected readonly budgetedHint = computed(() => {
    const count = this.data()?.budgets.length ?? 0;
    return count === 0 ? 'No limits set yet' : `Across ${categoriesLabel(count)}`;
  });

  protected readonly spentHint = computed(() => {
    const data = this.data();

    if (!data) {
      return null;
    }

    const unbudgeted = this.unbudgetedSpending().reduce((sum, item) => sum + item.spent, 0);
    const scope =
      unbudgeted > 0
        ? `incl. ${formatMoney(unbudgeted, data.status.currency)} unbudgeted`
        : 'all categories';

    return `${monthProgress(data.status)} · ${scope}`;
  });

  protected readonly remainingHint = computed(() => {
    const status = this.data()?.status;

    if (!status) {
      return null;
    }

    if (status.totalLimit === 0) {
      return 'Nothing budgeted';
    }

    if (status.totalSpent > status.totalLimit) {
      return `${formatMoney(status.totalSpent - status.totalLimit, status.currency)} over the total budget`;
    }

    return 'Budgeted less everything spent';
  });

  protected readonly previousMonthLabel = computed(() => {
    const data = this.data();
    return data ? formatMonth(addMonths(data.month, -1)) : '';
  });

  protected readonly copyCandidates = computed(() => {
    const data = this.data();

    if (!data) {
      return [];
    }

    const active = this.activeIds();
    const budgeted = new Set(data.budgets.map((budget) => budget.categoryId));

    const failed = this.isRetryingCopy() ? this.partialCopy()?.categoryIds : undefined;

    return data.previous.filter(
      (budget) =>
        active.has(budget.categoryId) &&
        !budgeted.has(budget.categoryId) &&
        (!failed || failed.has(budget.categoryId)),
    );
  });

  protected readonly skippedArchivedCount = computed(() => {
    const active = this.activeIds();
    return (this.data()?.previous ?? []).filter((budget) => !active.has(budget.categoryId)).length;
  });

  protected readonly isRetryingCopy = computed(() => {
    const data = this.data();
    return data !== null && data.budgets.length > 0 && this.partialCopy()?.month === data.month;
  });

  protected readonly showCopy = computed(() => {
    const data = this.data();

    return (
      data !== null &&
      this.copyCandidates().length > 0 &&
      (data.budgets.length === 0 || this.isRetryingCopy())
    );
  });

  protected readonly copyTitle = computed(() =>
    this.isRetryingCopy()
      ? 'Some budgets were not copied'
      : `Start from ${this.previousMonthLabel()}’s limits`,
  );

  protected readonly copyMessage = computed(() => {
    const count = this.copyCandidates().length;

    if (this.isRetryingCopy()) {
      const missing = count === 1 ? 'is still missing' : 'are still missing';
      const which = count === 1 ? 'that one' : 'those';

      return (
        `${budgetsLabel(count)} from ${this.previousMonthLabel()} ${missing}. ` +
        `Copying again adds only ${which}.`
      );
    }

    const skipped = this.skippedArchivedCount();
    const skippedNote =
      skipped === 0
        ? ''
        : skipped === 1
          ? ' One for an archived category will be left out.'
          : ` ${skipped} for archived categories will be left out.`;

    return (
      `${this.monthLabel()} has no budgets yet. Carry last month’s limits over as a starting ` +
      `point, then adjust any of them.${skippedNote}`
    );
  });

  protected readonly copyLabel = computed(() => {
    const count = budgetsLabel(this.copyCandidates().length);

    return this.isRetryingCopy()
      ? `Copy the remaining ${count}`
      : `Copy ${count} from ${this.previousMonthLabel()}`;
  });

  protected readonly formMonth = computed(() => this.editing()?.month ?? this.month());

  protected readonly formCategories = computed(() => this.current()?.categories ?? []);
  protected readonly formBudgets = computed(() => this.current()?.budgets ?? []);
  protected readonly currency = computed(() => this.data()?.status.currency ?? null);

  protected readonly removeTitle = computed(() => {
    const budget = this.pendingRemove();
    return budget ? `Remove the “${budget.categoryName}” budget?` : '';
  });

  protected readonly removeMessage = computed(() => {
    const budget = this.pendingRemove();

    return budget
      ? `${budget.categoryName} will have no limit for ${formatMonth(budget.month)}. ` +
          'Its expenses are not affected.'
      : '';
  });

  constructor() {
    merge(toObservable(this.month), this.reloads.pipe(map(() => this.month())))
      .pipe(
        tap(() => {
          this.refreshing.set(true);
          this.error.set(null);
        }),
        switchMap((month) =>
          this.fetch(month).pipe(
            catchError((error: unknown) => {
              this.error.set(toApiError(error));
              this.initialLoad.set(false);
              this.refreshing.set(false);

              this.focusAfterCopy = false;
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        this.data.set(data);
        this.initialLoad.set(false);
        this.refreshing.set(false);

        if (this.isRetryingCopy() && this.copyCandidates().length === 0) {
          this.partialCopy.set(null);
        }

        if (this.focusAfterCopy) {
          this.focusAfterCopy = false;
          this.restoreFocus();
        }
      });
  }

  protected reload(): void {
    this.reloads.next();
  }

  protected openCreate(presetCategoryId: string | null): void {
    this.editing.set(null);
    this.presetCategoryId.set(presetCategoryId);
    this.formOpen.set(true);
  }

  protected openEdit(budget: Budget): void {
    this.editing.set(budget);
    this.presetCategoryId.set(null);
    this.formOpen.set(true);
  }

  protected onSaved(budget: Budget): void {
    this.notifications.success(
      `Set ${budget.categoryName} to ${formatMoney(budget.limit, budget.currency)} ` +
        `for ${formatMonth(budget.month)}.`,
    );
    this.formOpen.set(false);
    this.reload();
  }

  protected isActive(categoryId: string): boolean {
    return this.activeIds().has(categoryId);
  }

  protected confirmRemove(): void {
    const budget = this.pendingRemove();

    if (!budget) {
      return;
    }

    this.removing.set(true);

    this.budgetsApi
      .delete(budget.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removing.set(false);
          this.pendingRemove.set(null);
          this.notifications.success(
            `Removed the ${budget.categoryName} budget for ${formatMonth(budget.month)}.`,
          );
          this.reload();
        },
        error: (error: unknown) => {
          this.removing.set(false);
          this.pendingRemove.set(null);

          this.notifications.error(error);
          this.reload();
        },
      });
  }

  protected copyFromPrevious(): void {

    const data = this.current();
    const candidates = this.copyCandidates();

    if (!data || candidates.length === 0 || this.copying() || this.refreshing()) {
      return;
    }

    const month = data.month;
    const previousLabel = this.previousMonthLabel();

    this.copying.set(true);

    this.budgetsApi
      .listForMonth(month)
      .pipe(
        switchMap((fresh) => {
          const taken = new Set(fresh.map((budget) => budget.categoryId));
          const pending = candidates.filter((budget) => !taken.has(budget.categoryId));

          return from(pending).pipe(
            mergeMap(
              (budget) =>
                this.budgetsApi
                  .upsert({ categoryId: budget.categoryId, month, limit: budget.limit })
                  .pipe(
                    map((): CopyOutcome => ({ categoryId: budget.categoryId, error: null })),
                    catchError((error: unknown) =>
                      of<CopyOutcome>({ categoryId: budget.categoryId, error: toApiError(error) }),
                    ),
                  ),
              COPY_CONCURRENCY,
            ),
            toArray(),
            map((outcomes) => ({ outcomes, kept: candidates.length - pending.length })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ outcomes, kept }) => {
          this.copying.set(false);

          const failures = outcomes.filter((outcome) => outcome.error !== null);
          const copied = outcomes.length - failures.length;
          const keptNote =
            kept === 0
              ? ''
              : kept === 1
                ? ' 1 already had a budget and was left as it is.'
                : ` ${kept} already had a budget and were left as they are.`;

          if (failures.length === 0) {
            this.partialCopy.set(null);
            this.notifications.success(
              copied === 0
                ? `Nothing copied.${keptNote}`
                : `Copied ${budgetsLabel(copied)} from ${previousLabel}.${keptNote}`,
            );
          } else {
            this.partialCopy.set({
              month,
              categoryIds: new Set(failures.map((failure) => failure.categoryId)),
            });
            this.notifications.error(
              `Copied ${copied} of ${outcomes.length} budgets. ${failures[0].error?.displayMessage} ` +
                'Copying again picks up the rest.',
            );
          }

          this.focusAfterCopy = true;
          this.reload();
        },

        error: (error: unknown) => {
          this.copying.set(false);
          this.notifications.error(error);
          this.focusAfterCopy = true;
          this.reload();
        },
      });
  }

  private restoreFocus(): void {
    afterNextRender(
      {
        write: () => {
          const active = this.document.activeElement;

          if (active && active !== this.document.body) {
            return;
          }

          (this.copyButton() ?? this.content())?.nativeElement.focus();
        },
      },
      { injector: this.injector },
    );
  }

  private fetch(month: string): Observable<MonthData> {
    return forkJoin({
      status: this.reportsApi.budgetStatus(month),
      budgets: this.budgetsApi.listForMonth(month),
      categories: this.categoriesApi.list(false),
    }).pipe(
      switchMap(({ status: serverStatus, budgets, categories }) => {
        const status = withLocalProgress(serverStatus);

        if (budgets.length > 0 && this.partialCopy()?.month !== month) {
          return of<MonthData>({ month, status, budgets, categories, previous: [] });
        }

        return this.budgetsApi.listForMonth(addMonths(month, -1)).pipe(
          catchError(() => of<Budget[]>([])),
          map((previous): MonthData => ({ month, status, budgets, categories, previous })),
        );
      }),
    );
  }
}

function riskTier(item: BudgetStatusItem): number {
  if (item.isOverBudget) {
    return 0;
  }

  if ((item.percentUsed ?? 0) >= NEAR_LIMIT_PERCENT) {
    return 1;
  }

  if (item.limit !== null && item.projectedSpend !== null && item.projectedSpend > item.limit) {
    return 2;
  }

  return 3;
}

function emptyItemFor(budget: Budget): BudgetStatusItem {
  return {
    categoryId: budget.categoryId,
    categoryName: budget.categoryName,
    colorHex: budget.categoryColorHex,
    limit: budget.limit,
    spent: 0,
    remaining: budget.limit,
    percentUsed: 0,
    isOverBudget: false,
    projectedSpend: null,
  };
}

function monthProgress(status: BudgetStatus): string {
  if (status.isCurrentMonth) {
    return `Day ${status.daysElapsed} of ${status.daysInMonth}`;
  }

  return status.daysElapsed === 0 ? 'Not started yet' : 'Month complete';
}

function budgetsLabel(count: number): string {
  return count === 1 ? '1 budget' : `${count} budgets`;
}

function categoriesLabel(count: number): string {
  return count === 1 ? '1 category' : `${count} categories`;
}
