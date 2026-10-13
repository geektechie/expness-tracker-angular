import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Notifications, ToastKind } from '../../../core/services/notifications';
import { Icon, IconName } from '../icon/icon';

const ICON_BY_KIND: Record<ToastKind, IconName> = {
  success: 'check-circle',
  error: 'x-circle',
  info: 'info',
};

@Component({
  selector: 'app-toast-host',
  imports: [Icon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.css',
})
export class ToastHost {
  protected readonly notifications = inject(Notifications);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly notices = computed(() =>
    this.notifications.toasts().filter((toast) => toast.kind !== 'error'),
  );
  protected readonly errors = computed(() =>
    this.notifications.toasts().filter((toast) => toast.kind === 'error'),
  );

  private focusedId: number | null = null;

  constructor() {
    afterRenderEffect(() => {
      const toasts = this.notifications.toasts();
      const removedId = this.focusedId;

      if (removedId === null || toasts.some((toast) => toast.id === removedId)) {
        return;
      }

      this.focusedId = null;

      const doc = this.host.nativeElement.ownerDocument;

      if (doc.activeElement !== null && doc.activeElement !== doc.body) {
        return;
      }

      const next = toasts.find((toast) => toast.id > removedId) ?? toasts.at(-1);
      const target = next
        ? this.host.nativeElement.querySelector<HTMLElement>(`[data-toast-id="${next.id}"] button`)
        : doc.querySelector<HTMLElement>('main');

      target?.focus();
    });
  }

  protected iconFor(kind: ToastKind): IconName {
    return ICON_BY_KIND[kind];
  }

  protected onFocusIn(id: number): void {
    this.focusedId = id;
    this.notifications.pause(id);
  }

  protected onFocusOut(id: number, event: FocusEvent): void {
    this.notifications.resume(id);

    const toast = event.currentTarget as HTMLElement;
    const stillShown = this.notifications.toasts().some((item) => item.id === id);

    if (stillShown && !toast.contains(event.relatedTarget as Node | null) && this.focusedId === id) {
      this.focusedId = null;
    }
  }
}
