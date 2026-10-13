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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';
import { CategoriesApi } from '../../../core/api/categories-api';
import { ApiError } from '../../../core/http/api-error';
import { toApiError } from '../../../core/http/api-error-interceptor';
import { Category } from '../../../core/models/category';
import { Notifications } from '../../../core/services/notifications';
import { CategoryChip } from '../../../shared/components/category-chip/category-chip';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorBanner } from '../../../shared/components/error-banner/error-banner';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { TimestampPipe } from '../../../shared/pipes/timestamp-pipe';
import { CategoryForm } from '../category-form/category-form';

@Component({
  selector: 'app-category-list',
  imports: [
    CategoryChip,
    CategoryForm,
    ConfirmDialog,
    EmptyState,
    ErrorBanner,
    Icon,
    PageHeader,
    RouterLink,
    TimestampPipe,
  ],
  templateUrl: './category-list.html',
  styleUrl: './category-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryList {
  private readonly api = inject(CategoriesApi);
  private readonly notifications = inject(Notifications);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  private readonly tableSection = viewChild<ElementRef<HTMLElement>>('tableSection');

  protected readonly categories = signal<Category[]>([]);

  protected readonly initialLoad = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly showArchived = signal(false);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Category | null>(null);

  protected readonly pendingDelete = signal<Category | null>(null);
  protected readonly deleting = signal(false);

  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());

  protected readonly archivedCount = computed(
    () => this.categories().filter((category) => category.isArchived).length,
  );

  protected readonly visible = computed(() =>
    this.showArchived() ? this.categories() : this.categories().filter((c) => !c.isArchived),
  );

  private readonly reloads = new Subject<void>();

  constructor() {
    this.reloads
      .pipe(
        tap(() => {
          this.refreshing.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.api.list(true).pipe(
            catchError((error: unknown) => {
              this.error.set(toApiError(error));
              this.refreshing.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((categories) => {
        this.categories.set(categories);
        this.initialLoad.set(false);
        this.refreshing.set(false);
      });

    this.load();
  }

  protected load(): void {
    this.reloads.next();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(category: Category): void {
    this.editing.set(category);
    this.formOpen.set(true);
  }

  protected onSaved(category: Category): void {
    this.notifications.success(
      this.editing() ? `Saved “${category.name}”.` : `Created “${category.name}”.`,
    );
    this.formOpen.set(false);
    this.load();
  }

  protected onGone(): void {
    const name = this.editing()?.name;

    this.formOpen.set(false);
    this.notifications.error(
      name
        ? `“${name}” was deleted elsewhere, so the changes could not be saved.`
        : 'That category was deleted elsewhere, so the changes could not be saved.',
    );
    this.load();
  }

  protected setArchived(category: Category, archived: boolean): void {
    if (this.busyIds().has(category.id)) {
      return;
    }

    this.markBusy(category.id, true);

    this.api
      .update(category.id, { isArchived: archived })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.markBusy(category.id, false);

          this.patchLocally((all) => all.map((c) => (c.id === updated.id ? updated : c)));

          this.restoreFocus(updated.id);

          this.notifications.success(
            archived
              ? `Archived “${updated.name}”. Its history is kept; it can't take new expenses.`
              : `Restored “${updated.name}”.`,
          );
        },
        error: (error: unknown) => {
          this.markBusy(category.id, false);

          if (toApiError(error).isNotFound) {
            this.notifications.error(`“${category.name}” was deleted elsewhere.`);
            this.load();
            return;
          }

          this.notifications.error(error);
        },
      });
  }

  protected confirmDelete(): void {
    const category = this.pendingDelete();

    if (!category) {
      return;
    }

    this.deleting.set(true);

    this.api
      .delete(category.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.pendingDelete.set(null);
          this.patchLocally((all) => all.filter((c) => c.id !== category.id));
          this.restoreFocus();
          this.notifications.success(`Deleted “${category.name}”.`);
        },
        error: (error: unknown) => {
          this.deleting.set(false);
          this.pendingDelete.set(null);

          if (toApiError(error).isNotFound) {
            this.patchLocally((all) => all.filter((c) => c.id !== category.id));
            this.restoreFocus();
            this.notifications.info(`“${category.name}” was already deleted.`);
            return;
          }

          this.notifications.error(error);
          this.load();
        },
      });
  }

  protected expensesLabel(count: number): string {
    return count === 1 ? '1 expense' : `${count} expenses`;
  }

  private markBusy(id: string, busy: boolean): void {
    this.busyIds.update((ids) => {
      const next = new Set(ids);

      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  private restoreFocus(rowId?: string): void {
    afterNextRender(
      () => {
        const active = this.document.activeElement;

        if (active && active !== this.document.body) {
          return;
        }

        const section = this.tableSection()?.nativeElement;
        const target = rowId
          ? section?.querySelector<HTMLElement>(`tr[data-row-id="${rowId}"] .archive-toggle`)
          : null;

        (target ?? section)?.focus();
      },
      { injector: this.injector },
    );
  }

  private patchLocally(change: (all: Category[]) => Category[]): void {
    this.categories.update(change);

    if (this.refreshing()) {
      this.load();
    }
  }
}
