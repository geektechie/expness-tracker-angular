import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icon } from '../icon/icon';

let nextModalId = 0;

let scrollLocks = 0;
let unlockedStyles = { overflow: '', scrollbarGutter: '' };

const INITIAL_FOCUS = [
  '[autofocus]:not(:disabled)',
  '.body :is(input:not([type="hidden"]), select, textarea):not(:disabled)',
];

@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  readonly describedBy = input<string | null>(null);

  readonly dialogRole = input<'dialog' | 'alertdialog'>('dialog');

  readonly dismissible = input(true);

  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${nextModalId++}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly document = inject(DOCUMENT);

  private scrollLocked = false;
  private pointerDownOnBackdrop = false;

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;

      if (this.open() && !element.open) {
        element.showModal();
        this.setScrollLock(true);
        this.focusInitial(element);
      } else if (!this.open() && element.open) {
        element.close();
        this.setScrollLock(false);
      }
    });

    inject(DestroyRef).onDestroy(() => this.setScrollLock(false));
  }

  protected requestClose(): void {
    if (this.dismissible()) {
      this.closed.emit();
    }
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }

  protected onNativeClose(): void {
    const element = this.dialog().nativeElement;

    if (!this.open() || element.open) {
      return;
    }

    if (this.dismissible()) {
      this.setScrollLock(false);
      this.closed.emit();
    } else {
      element.showModal();
    }
  }

  protected onDialogPointerDown(event: PointerEvent): void {
    this.pointerDownOnBackdrop = event.target === this.dialog().nativeElement;
  }

  protected onDialogClick(event: MouseEvent): void {
    const startedOnBackdrop = this.pointerDownOnBackdrop;
    this.pointerDownOnBackdrop = false;

    if (startedOnBackdrop && event.target === this.dialog().nativeElement) {
      this.requestClose();
    }
  }

  private focusInitial(element: HTMLDialogElement): void {
    for (const selector of INITIAL_FOCUS) {
      const target = element.querySelector<HTMLElement>(selector);

      if (target) {
        target.focus();
        return;
      }
    }
  }

  private setScrollLock(locked: boolean): void {
    if (locked === this.scrollLocked) {
      return;
    }

    this.scrollLocked = locked;
    const root = this.document.documentElement;

    if (locked && scrollLocks++ === 0) {
      unlockedStyles = {
        overflow: root.style.overflow,
        scrollbarGutter: root.style.scrollbarGutter,
      };
      const hasScrollbar = (this.document.defaultView?.innerWidth ?? 0) > root.clientWidth;

      root.style.overflow = 'hidden';

      if (hasScrollbar) {
        root.style.scrollbarGutter = 'stable';
      }
    } else if (!locked && --scrollLocks === 0) {
      root.style.overflow = unlockedStyles.overflow;
      root.style.scrollbarGutter = unlockedStyles.scrollbarGutter;
    }
  }
}
