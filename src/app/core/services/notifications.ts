import { Injectable, signal } from '@angular/core';
import { toApiError } from '../http/api-error-interceptor';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface DismissTimer {
  handle: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
  holds: number;
}

const MIN_RESUME_MS = 1_000;

@Injectable({ providedIn: 'root' })
export class Notifications {
  private readonly items = signal<Toast[]>([]);
  private readonly timers = new Map<number, DismissTimer>();
  private nextId = 1;

  readonly toasts = this.items.asReadonly();

  success(message: string): void {
    this.push('success', message, 4_000);
  }

  info(message: string): void {
    this.push('info', message, 4_000);
  }

  error(error: unknown): void {
    const message = typeof error === 'string' ? error : toApiError(error).displayMessage;
    this.push('error', message, null);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.items.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  pause(id: number): void {
    const timer = this.timers.get(id);

    if (!timer) {
      return;
    }

    timer.holds++;

    if (timer.handle !== null) {
      clearTimeout(timer.handle);
      timer.handle = null;
      timer.remaining -= Date.now() - timer.startedAt;
    }
  }

  resume(id: number): void {
    const timer = this.timers.get(id);

    if (!timer || timer.holds === 0) {
      return;
    }

    timer.holds--;

    if (timer.holds === 0) {
      this.startTimer(id, timer, Math.max(timer.remaining, MIN_RESUME_MS));
    }
  }

  private push(kind: ToastKind, message: string, durationMs: number | null): void {
    const id = this.nextId++;
    let evicted: Toast[] = [];
    this.items.update((toasts) => {
      const next = [...toasts, { id, kind, message }];
      evicted = next.slice(0, -4);
      return next.slice(-4);
    });

    for (const toast of evicted) {
      this.clearTimer(toast.id);
    }

    if (durationMs !== null) {
      this.startTimer(id, { handle: null, remaining: durationMs, startedAt: 0, holds: 0 }, durationMs);
    }
  }

  private startTimer(id: number, timer: DismissTimer, durationMs: number): void {
    timer.handle = setTimeout(() => this.dismiss(id), durationMs);
    timer.remaining = durationMs;
    timer.startedAt = Date.now();
    this.timers.set(id, timer);
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);

    if (timer && timer.handle !== null) {
      clearTimeout(timer.handle);
    }
    this.timers.delete(id);
  }
}
