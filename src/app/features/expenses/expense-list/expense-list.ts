import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  catchError,
  debounceTime,
  map,
  of,
  switchMap,
} from 'rxjs';
import { CategoriesApi } from '../../../core/api/categories-api';
import { ExpensesApi } from '../../../core/api/expenses-api';
import { ApiError } from '../../../core/http/api-error';
import { toApiError } from '../../../core/http/api-error-interceptor';
import { Category } from '../../../core/models/category';
import { EXPENSE_SORTS, Expense, ExpenseQuery, ExpenseSort } from '../../../core/models/expense';
import { PagedResult } from '../../../core/models/paged-result';
import { PAYMENT_METHODS, PaymentMethod } from '../../../core/models/payment-method';
import { Notifications } from '../../../core/services/notifications';
import { CategoryChip } from '../../../shared/components/category-chip/category-chip';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { CalendarDatePipe } from '../../../shared/pipes/calendar-date-pipe';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { PaymentMethodLabelPipe } from '../../../shared/pipes/payment-method-label-pipe';
import { parseIsoDate, toIsoDate } from '../../../shared/utils/dates';
import { formatMoney } from '../../../shared/utils/money';
import { ExpenseForm } from '../expense-form/expense-form';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const SEARCH_MAX_LENGTH = 200;
const DEFAULT_SORT: ExpenseSort = 'SpentOnDesc';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ListOutcome =
  | { ok: true; query: ExpenseQuery; result: PagedResult<Expense> }
  | { ok: false; query: ExpenseQuery; error: ApiError };

function isFiltered(query: ExpenseQuery): boolean {
  return Boolean(query.search || query.categoryId || query.paymentMethod || query.from || query.to);
}

@Component({
  selector: 'app-expense-list',
  imports: [
    CalendarDatePipe,
    CategoryChip,
    ConfirmDialog,
    EmptyState,
    ErrorBanner,
    ExpenseForm,
    Icon,
    MoneyPipe,
    PageHeader,
    Pagination,
    PaymentMethodLabelPipe,
  ],
  templateUrl: './expense-list.html',
  styleUrl: './expense-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseList implements OnInit {
  readonly categoryId = input<string | undefined>();
  readonly from = input<string | undefined>();
  readonly to = input<string | undefined>();

  readonly openNew = input<string | undefined>(undefined, { alias: 'new' });

  private readonly api = inject(ExpensesApi);
  private readonly categoriesApi = inject(CategoriesApi);
  private readonly notifications = inject(Notifications);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private readonly tableSection = viewChild<ElementRef<HTMLElement>>('tableSection');

  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly sorts = EXPENSE_SORTS;
  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;

  protected readonly result = signal<PagedResult<Expense> | null>(null);
  protected readonly resultIsFiltered = signal(false);

  protected readonly initialLoad = signal(true);
  protected readonly refreshing = signal(false);
  private readonly listError = signal<ApiError | null>(null);

  protected readonly categories = signal<Category[]>([]);
  protected readonly categoriesLoaded = signal(false);
  private readonly categoriesError = signal<ApiError | null>(null);

  protected readonly error = computed(() => this.listError() ?? this.categoriesError());
  protected readonly showTable = computed(() => !this.initialLoad() && !this.listError());

  protected readonly searchInput = signal('');

  private readonly search = signal('');
  protected readonly categoryFilter = signal('');
  protected readonly paymentFilter = signal<PaymentMethod | ''>('');
  protected readonly fromFilter = signal('');
  protected readonly toFilter = signal('');
  protected readonly sort = signal<ExpenseSort>(DEFAULT_SORT);
  protected readonly page = signal(1);

  private readonly reloadTick = signal(0);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Expense | null>(null);

  protected readonly pendingDelete = signal<Expense | null>(null);
  protected readonly deleting = signal(false);

  private openNewPending = false;

  private focusListAfterReload = false;

  protected readonly rangeError = computed(() => {
    const from = this.fromFilter();
    const to = this.toFilter();

    return from && to && to < from ? 'The end date cannot fall before the start date.' : null;
  });

  protected readonly filtersActive = computed(
    () =>
      this.searchInput().trim() !== '' ||
      this.categoryFilter() !== '' ||
      this.paymentFilter() !== '' ||
      this.fromFilter() !== '' ||
      this.toFilter() !== '',
  );

  protected readonly archivedCategoryIds = computed(
    () => new Set(this.categories().filter((c) => c.isArchived).map((c) => c.id)),
  );

  protected readonly deleteTitle = computed(() => {
    const expense = this.pendingDelete();

    return expense
      ? `Delete “${expense.description}” (${formatMoney(expense.amount, expense.currency)})?`
      : '';
  });

  private readonly query = computed<ExpenseQuery>(() => ({
    page: this.page(),
    pageSize: PAGE_SIZE,
    search: this.search() || undefined,
    categoryId: this.categoryFilter() || undefined,
    paymentMethod: this.paymentFilter() || undefined,
    from: this.fromFilter() || undefined,
    to: this.toFilter() || undefined,
    sort: this.sort(),
  }));

  private readonly request = computed(() => ({
    query: this.query(),
    blocked: this.rangeError() !== null,
    tick: this.reloadTick(),
  }));

  constructor() {
    toObservable(this.searchInput)
      .pipe(
        map((value) => value.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((search) => {

        if (search !== this.search()) {
          this.search.set(search);
          this.page.set(1);
        }
      });
  }

  ngOnInit(): void {
    this.categoryFilter.set(this.validCategoryId(this.categoryId()));
    this.fromFilter.set(this.validDate(this.from()));
    this.toFilter.set(this.validDate(this.to()));
    this.openNewPending = this.openNew() !== undefined;

    this.watchList();
    this.loadCategories();
    this.followRouteInputs();
  }

  protected retry(): void {
    if (this.categoriesError()) {
      this.loadCategories();
    }

    if (this.listError()) {
      this.reload();
    }
  }

  protected setCategory(value: string): void {
    this.categoryFilter.set(value);
    this.page.set(1);
    this.syncRouteFilters();
  }

  protected setPaymentMethod(value: string): void {
    this.paymentFilter.set(PAYMENT_METHODS.find((method) => method.value === value)?.value ?? '');
    this.page.set(1);
  }

  protected setFrom(value: string): void {
    this.fromFilter.set(value);
    this.page.set(1);
    this.syncRouteFilters();
  }

  protected setTo(value: string): void {
    this.toFilter.set(value);
    this.page.set(1);
    this.syncRouteFilters();
  }

  protected setSort(value: string): void {
    this.sort.set(EXPENSE_SORTS.find((sort) => sort.value === value)?.value ?? DEFAULT_SORT);
    this.page.set(1);
  }

  protected clearFilters(): void {
    this.searchInput.set('');
    this.search.set('');
    this.categoryFilter.set('');
    this.paymentFilter.set('');
    this.fromFilter.set('');
    this.toFilter.set('');
    this.page.set(1);
    this.syncRouteFilters();

    this.searchBox()?.nativeElement.focus();
  }

  protected goToPage(page: number): void {
    this.page.set(page);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(expense: Expense): void {
    this.editing.set(expense);
    this.formOpen.set(true);
  }

  protected onSaved(expense: Expense): void {
    const amount = formatMoney(expense.amount, expense.currency);

    this.notifications.success(
      this.editing()
        ? `Saved “${expense.description}” (${amount}).`
        : `Added “${expense.description}” (${amount}).`,
    );
    this.formOpen.set(false);
    this.reload();
  }

  protected onGone(): void {
    const description = this.editing()?.description;

    this.formOpen.set(false);
    this.notifications.error(
      description
        ? `“${description}” was deleted elsewhere, so the changes could not be saved.`
        : 'That expense was deleted elsewhere, so the changes could not be saved.',
    );
    this.reload();
  }

  protected confirmDelete(): void {
    const expense = this.pendingDelete();

    if (!expense) {
      return;
    }

    this.deleting.set(true);

    this.api
      .delete(expense.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.pendingDelete.set(null);
          this.notifications.success(`Deleted “${expense.description}”.`);

          this.focusListAfterReload = true;
          this.reload();
        },
        error: (error: unknown) => {
          this.deleting.set(false);
          this.pendingDelete.set(null);
          this.notifications.error(error);

          if (toApiError(error).isNotFound) {
            this.focusListAfterReload = true;
            this.reload();
          }
        },
      });
  }

  private reload(): void {
    this.reloadTick.update((tick) => tick + 1);
  }

  private watchList(): void {
    toObservable(this.request, { injector: this.injector })
      .pipe(
        switchMap(({ query, blocked }): Observable<ListOutcome> => {
          if (blocked) {
            this.refreshing.set(false);
            this.initialLoad.set(false);

            this.listError.set(null);
            this.focusListAfterReload = false;
            return EMPTY;
          }

          this.refreshing.set(true);
          this.listError.set(null);

          return this.api.list(query).pipe(
            map((result): ListOutcome => ({ ok: true, query, result })),
            catchError((error: unknown) =>
              of<ListOutcome>({ ok: false, query, error: toApiError(error) }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((outcome) => {
        this.initialLoad.set(false);

        if (!outcome.ok) {
          this.refreshing.set(false);
          this.listError.set(outcome.error);
          this.focusListAfterReload = false;
          return;
        }

        const result = outcome.result;

        if (result.items.length === 0 && result.page > 1 && result.totalPages < result.page) {
          this.page.set(Math.max(1, result.totalPages));
          return;
        }

        this.refreshing.set(false);
        this.result.set(result);
        this.resultIsFiltered.set(isFiltered(outcome.query));

        if (this.focusListAfterReload) {
          this.focusListAfterReload = false;

          afterNextRender(
            { write: () => this.tableSection()?.nativeElement.focus() },
            { injector: this.injector },
          );
        }
      });
  }

  private loadCategories(): void {
    this.categoriesError.set(null);

    this.categoriesApi
      .list(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
          this.categoriesLoaded.set(true);
          this.honourOpenNew();
        },
        error: (error: unknown) => {
          this.categoriesError.set(toApiError(error));
        },
      });
  }

  private followRouteInputs(): void {
    effect(
      () => {
        const categoryId = this.validCategoryId(this.categoryId());
        const from = this.validDate(this.from());
        const to = this.validDate(this.to());

        untracked(() => this.applyRouteFilters(categoryId, from, to));
      },
      { injector: this.injector },
    );

    effect(
      () => {
        if (this.openNew() !== undefined) {
          untracked(() => {
            this.openNewPending = true;
            this.honourOpenNew();
          });
        }
      },
      { injector: this.injector },
    );
  }

  private applyRouteFilters(categoryId: string, from: string, to: string): void {
    if (
      categoryId === this.categoryFilter() &&
      from === this.fromFilter() &&
      to === this.toFilter()
    ) {
      return;
    }

    this.categoryFilter.set(categoryId);
    this.fromFilter.set(from);
    this.toFilter.set(to);
    this.page.set(1);
  }

  private honourOpenNew(): void {
    if (!this.openNewPending || !this.categoriesLoaded()) {
      return;
    }

    this.openNewPending = false;
    this.openCreate();
    this.forgetOpenNew();
  }

  private forgetOpenNew(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { new: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private syncRouteFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        categoryId: this.categoryFilter() || null,
        from: this.fromFilter() || null,
        to: this.toFilter() || null,
      },
      queryParamsHandling: 'merge',

      replaceUrl: true,
    });
  }

  private validDate(value: string | undefined): string {
    return value && ISO_DATE.test(value) && toIsoDate(parseIsoDate(value)) === value ? value : '';
  }

  private validCategoryId(value: string | undefined): string {
    const trimmed = value?.trim() ?? '';

    return GUID.test(trimmed) ? trimmed : '';
  }
}
