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
import { CategoriesApi } from '../../../core/api/categories-api';
import { toApiError } from '../../../core/http/api-error-interceptor';
import { CATEGORY_NAME_MAX_LENGTH, Category } from '../../../core/models/category';
import { Modal } from '../../../shared/components/modal/modal';
import {
  controlErrorMessage,
  notBlank,
  placeServerErrors,
} from '../../../shared/utils/form-errors';

export interface CategorySwatch {
  hex: string;
  name: string;
}

export const CATEGORY_SWATCHES: readonly CategorySwatch[] = [
  { hex: '#2E7D32', name: 'Green' },
  { hex: '#EF6C00', name: 'Orange' },
  { hex: '#1565C0', name: 'Blue' },
  { hex: '#6A1B9A', name: 'Purple' },
  { hex: '#00838F', name: 'Teal' },
  { hex: '#C62828', name: 'Red' },
  { hex: '#AD1457', name: 'Pink' },
  { hex: '#4527A0', name: 'Indigo' },
  { hex: '#795548', name: 'Brown' },
  { hex: '#F9A825', name: 'Amber' },
  { hex: '#558B2F', name: 'Olive' },
  { hex: '#546E7A', name: 'Slate' },
];

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

@Component({
  selector: 'app-category-form',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './category-form.html',
  styleUrl: './category-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryForm {
  readonly open = input(false);
  readonly category = input<Category | null>(null);
  readonly existing = input<readonly Category[]>([]);

  readonly closed = output<void>();
  readonly saved = output<Category>();
  readonly gone = output<void>();

  private readonly api = inject(CategoriesApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly swatches = CATEGORY_SWATCHES;
  protected readonly nameMaxLength = CATEGORY_NAME_MAX_LENGTH;

  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly isEdit = computed(() => this.category() !== null);
  protected readonly title = computed(() => (this.isEdit() ? 'Edit category' : 'New category'));

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, notBlank, Validators.maxLength(CATEGORY_NAME_MAX_LENGTH)]],
    colorHex: [CATEGORY_SWATCHES[0].hex, [Validators.required, Validators.pattern(HEX_PATTERN)]],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        const category = this.category();
        untracked(() => this.reset(category));
      }
    });
  }

  protected errorFor(field: 'name' | 'colorHex', label: string): string | null {
    return controlErrorMessage(this.form.controls[field], label);
  }

  protected isSelected(swatch: CategorySwatch): boolean {
    return this.form.controls.colorHex.value.toUpperCase() === swatch.hex;
  }

  protected isTabStop(swatch: CategorySwatch, index: number): boolean {
    return this.swatches.some((s) => this.isSelected(s)) ? this.isSelected(swatch) : index === 0;
  }

  protected pickSwatch(swatch: CategorySwatch): void {
    this.form.controls.colorHex.setValue(swatch.hex);
    this.form.controls.colorHex.markAsDirty();
  }

  protected onSwatchKeydown(event: KeyboardEvent, index: number): void {
    const count = this.swatches.length;
    let next: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % count;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.pickSwatch(this.swatches[next]);

    const group = (event.currentTarget as HTMLElement).parentElement;
    group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving()) {
      return;
    }

    const { name, colorHex } = this.form.getRawValue();
    const editing = this.category();
    const clash = this.clash(name);

    if (clash) {
      this.form.controls.name.setErrors({ server: this.clashMessage(clash) });
      return;
    }

    const request$ = editing
      ? this.api.update(editing.id, { name: name.trim(), colorHex })
      : this.api.create({ name: name.trim(), colorHex });

    this.saving.set(true);
    this.formError.set(null);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (category) => {
        this.saving.set(false);
        this.saved.emit(category);
      },
      error: (error: unknown) => {
        this.saving.set(false);

        const apiError = toApiError(error);

        if (editing && apiError.isNotFound) {
          this.gone.emit();
          return;
        }

        if (apiError.isConflict) {
          const taken = this.clash(name);

          this.form.controls.name.setErrors({
            server: taken ? this.clashMessage(taken) : apiError.displayMessage,
          });
          this.form.controls.name.markAsTouched();
          return;
        }

        const banner = placeServerErrors(this.form, apiError);

        if (banner) {
          this.formError.set(banner);
        }
      },
    });
  }

  private clash(name: string): Category | undefined {
    const normalised = name.trim().toLowerCase();
    const id = this.category()?.id;

    return this.existing().find(
      (c) => c.id !== id && c.name.trim().toLowerCase() === normalised,
    );
  }

  private clashMessage(clash: Category): string {
    return clash.isArchived
      ? `An archived category named “${clash.name}” already exists. Restore it instead.`
      : `A category named “${clash.name}” already exists.`;
  }

  private reset(category: Category | null): void {
    this.form.reset({
      name: category?.name ?? '',
      colorHex: category?.colorHex ?? CATEGORY_SWATCHES[0].hex,
    });
    this.formError.set(null);
    this.saving.set(false);
  }
}
