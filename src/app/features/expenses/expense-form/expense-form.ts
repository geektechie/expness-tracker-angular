import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExpensesApi } from '../../../core/api/expenses-api';
import { toApiError } from '../../../core/http/api-error-interceptor';
import { Category } from '../../../core/models/category';
import { EXPENSE_LIMITS, Expense } from '../../../core/models/expense';
import { PAYMENT_METHODS, PaymentMethod } from '../../../core/models/payment-method';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { Modal } from '../../../shared/components/modal/modal';
import { addDays, todayIso, utcTodayIso } from '../../../shared/utils/dates';
import {
  controlErrorMessage,
  maxDecimals,
  notBlank,
  placeServerErrors,
} from '../../../shared/utils/form-errors';

type ExpenseField = 'amount' | 'spentOn' | 'categoryId' | 'description' | 'paymentMethod' | 'notes';

interface CategoryOption {
  id: string;
  label: string;
}

const MAX_DAYS_AHEAD = 1;

function latestAllowedDate(): string {
  const local = addDays(todayIso(), MAX_DAYS_AHEAD);
  const utc = addDays(utcTodayIso(), MAX_DAYS_AHEAD);

  return local < utc ? local : utc;
}

function notTooFarAhead(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;

  if (typeof value !== 'string' || value === '') {
    return null;
  }

  return value > latestAllowedDate() ? { tooFarAhead: true } : null;
}

@Component({
  selector: 'app-expense-form',
  imports: [ConfirmDialog, Modal, ReactiveFormsModule, RouterLink],
  templateUrl: './expense-form.html',
  styleUrl: './expense-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseForm {
  readonly open = input(false);
  readonly expense = input<Expense | null>(null);

  readonly categories = input<Category[]>([]);

  readonly closed = output<void>();
  readonly saved = output<Expense>();
  readonly gone = output<void>();

  private readonly api = inject(ExpensesApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly limits = EXPENSE_LIMITS;

  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly confirmDiscard = signal(false);

  protected readonly latestDate = signal(latestAllowedDate());

  protected readonly isEdit = computed(() => this.expense() !== null);
  protected readonly title = computed(() => (this.isEdit() ? 'Edit expense' : 'New expense'));

  protected readonly categoryOptions = computed<CategoryOption[]>(() => {
    const all = this.categories();
    const options = all
      .filter((category) => !category.isArchived)
      .map((category) => ({ id: category.id, label: category.name }));

    const expense = this.expense();

    if (!expense || options.some((option) => option.id === expense.categoryId)) {
      return options;
    }

    const current = all.find((category) => category.id === expense.categoryId);
    const label = current?.isArchived ? `${expense.categoryName} (archived)` : expense.categoryName;

    return [...options, { id: expense.categoryId, label }].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  });

  protected readonly hasCategoryOptions = computed(() => this.categoryOptions().length > 0);

  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly form = this.fb.group({
    amount: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(EXPENSE_LIMITS.maxAmount),
      maxDecimals(2),
    ]),
    spentOn: [todayIso(), [Validators.required, notTooFarAhead]],
    categoryId: ['', Validators.required],
    description: [
      '',
      [Validators.required, notBlank, Validators.maxLength(EXPENSE_LIMITS.descriptionMaxLength)],
    ],
    paymentMethod: this.fb.control<PaymentMethod>('Cash', Validators.required),
    notes: ['', Validators.maxLength(EXPENSE_LIMITS.notesMaxLength)],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        const expense = this.expense();
        untracked(() => this.reset(expense));
      }
    });
  }

  protected errorFor(field: ExpenseField, label: string): string | null {
    const control = this.form.controls[field];

    if (
      control.hasError('tooFarAhead') &&
      !control.hasError('server') &&
      (control.touched || control.dirty)
    ) {
      return 'An expense can be dated at most one day ahead.';
    }

    return controlErrorMessage(control, label);
  }

  protected requestClose(): void {
    if (this.saving()) {
      return;
    }

    if (this.form.dirty) {
      this.confirmDiscard.set(true);
      return;
    }

    this.closed.emit();
  }

  protected discard(): void {
    this.confirmDiscard.set(false);
    this.closed.emit();
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving() || !this.hasCategoryOptions()) {
      return;
    }

    const { amount, spentOn, categoryId, description, paymentMethod, notes } =
      this.form.getRawValue();

    if (amount === null) {
      return;
    }

    const editing = this.expense();
    const trimmedNotes = notes.trim();

    const request$ = editing
      ? this.api.update(editing.id, {
          amount,
          spentOn,
          categoryId,
          description: description.trim(),
          paymentMethod,
          notes: trimmedNotes,
        })
      : this.api.create({
          amount,
          spentOn,
          categoryId,
          description: description.trim(),
          paymentMethod,
          notes: trimmedNotes || null,
        });

    this.saving.set(true);
    this.formError.set(null);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (expense) => {
        this.saving.set(false);
        this.saved.emit(expense);
      },
      error: (error: unknown) => {
        this.saving.set(false);

        const apiError = toApiError(error);

        if (editing && apiError.isNotFound) {
          this.gone.emit();
          return;
        }

        const banner = placeServerErrors(this.form, apiError);

        if (banner) {
          this.formError.set(banner);
        }
      },
    });
  }

  private reset(expense: Expense | null): void {
    this.latestDate.set(latestAllowedDate());

    this.form.reset({
      amount: expense?.amount ?? null,
      spentOn: expense?.spentOn ?? todayIso(),
      categoryId: expense?.categoryId ?? '',
      description: expense?.description ?? '',
      paymentMethod: expense?.paymentMethod ?? 'Cash',
      notes: expense?.notes ?? '',
    });
    this.formError.set(null);
    this.saving.set(false);
    this.confirmDiscard.set(false);
  }
}
