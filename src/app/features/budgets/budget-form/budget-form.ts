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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BudgetsApi } from '../../../core/api/budgets-api';
import { toApiError } from '../../../core/http/api-error-interceptor';
import { Budget } from '../../../core/models/budget';
import { Category } from '../../../core/models/category';
import { Modal } from '../../../shared/components/modal/modal';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { formatMonth } from '../../../shared/utils/dates';
import {
  controlErrorMessage,
  maxDecimals,
  placeServerErrors,
} from '../../../shared/utils/form-errors';

interface CategoryOption {
  id: string;
  name: string;
}

const LIMIT_MIN = 0.01;
const LIMIT_MAX = 1_000_000_000;

@Component({
  selector: 'app-budget-form',
  imports: [Modal, MoneyPipe, ReactiveFormsModule],
  templateUrl: './budget-form.html',
  styleUrl: './budget-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetForm {
  readonly open = input(false);
  readonly month = input.required<string>();
  readonly categories = input<readonly Category[]>([]);
  readonly existing = input<Budget | null>(null);
  readonly presetCategoryId = input<string | null>(null);
  readonly budgets = input<readonly Budget[]>([]);
  readonly currency = input<string | null>(null);

  readonly closed = output<void>();
  readonly saved = output<Budget>();

  private readonly api = inject(BudgetsApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly limitMin = LIMIT_MIN;
  protected readonly limitMax = LIMIT_MAX;

  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly isEdit = computed(() => this.existing() !== null);
  protected readonly title = computed(() => (this.isEdit() ? 'Edit budget' : 'Set budget'));
  protected readonly monthLabel = computed(() => formatMonth(this.month()));

  protected readonly limitHint = computed(() => {
    const currency = this.currency();
    const base = `The most you plan to spend on this category in ${this.monthLabel()}`;

    return currency ? `${base}, in ${currency}.` : `${base}.`;
  });

  protected readonly categoryOptions = computed<CategoryOption[]>(() => {
    const options = this.categories().map((category) => ({ id: category.id, name: category.name }));
    const existing = this.existing();

    if (existing && !options.some((option) => option.id === existing.categoryId)) {
      return [{ id: existing.categoryId, name: existing.categoryName }, ...options];
    }

    return options;
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    categoryId: ['', [Validators.required]],
    limit: [
      null as number | null,
      [Validators.required, Validators.min(LIMIT_MIN), Validators.max(LIMIT_MAX), maxDecimals(2)],
    ],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        const existing = this.existing();
        const presetCategoryId = this.presetCategoryId();
        untracked(() => this.reset(existing, presetCategoryId));
      }
    });
  }

  protected errorFor(field: 'categoryId' | 'limit', label: string): string | null {
    return controlErrorMessage(this.form.controls[field], label);
  }

  protected replacedBudget(): Budget | null {
    if (this.isEdit()) {
      return null;
    }

    const categoryId = this.form.controls.categoryId.value;

    return categoryId ? (this.budgets().find((budget) => budget.categoryId === categoryId) ?? null) : null;
  }

  protected submitLabel(): string {
    if (this.saving()) {
      return 'Saving…';
    }

    if (this.isEdit()) {
      return 'Save limit';
    }

    return this.replacedBudget() ? 'Replace budget' : 'Set budget';
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving()) {
      return;
    }

    const { categoryId, limit } = this.form.getRawValue();

    if (limit === null) {
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    this.api
      .upsert({ categoryId, month: this.month(), limit })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (budget) => {
          this.saving.set(false);
          this.saved.emit(budget);
        },
        error: (error: unknown) => {
          this.saving.set(false);

          const banner = placeServerErrors(this.form, toApiError(error));

          if (banner) {
            this.formError.set(banner);
          }
        },
      });
  }

  private reset(existing: Budget | null, presetCategoryId: string | null): void {
    const presetId =
      presetCategoryId !== null &&
      this.categoryOptions().some((option) => option.id === presetCategoryId)
        ? presetCategoryId
        : '';

    this.form.reset({
      categoryId: existing?.categoryId ?? presetId,
      limit: existing?.limit ?? null,
    });

    if (existing) {
      this.form.controls.categoryId.disable();
    } else {
      this.form.controls.categoryId.enable();
    }

    this.formError.set(null);
    this.saving.set(false);
  }
}
