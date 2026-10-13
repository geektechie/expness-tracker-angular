import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ApiError } from '../../../core/http/api-error';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-error-banner',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,

  host: { tabindex: '-1' },
  templateUrl: './error-banner.html',
  styleUrl: './error-banner.css',
})
export class ErrorBanner {
  readonly error = input<ApiError | null>(null);
  readonly retry = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly retryButton = viewChild<ElementRef<HTMLButtonElement>>('retryButton');

  private retryFocused = false;

  constructor() {

    afterRenderEffect(() => {
      const button = this.retryButton();

      if (!this.retryFocused) {
        return;
      }

      const host = this.host.nativeElement;
      const active = host.ownerDocument.activeElement;

      if (!button) {
        if (active === null || active === host.ownerDocument.body) {
          host.focus();
        }
        return;
      }

      if (active === host) {
        button.nativeElement.focus();
      }
      this.retryFocused = false;
    });
  }

  protected onRetry(): void {
    const host = this.host.nativeElement;

    this.retryFocused = host.contains(host.ownerDocument.activeElement);
    this.retry.emit();
  }
}
