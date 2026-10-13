import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  model,
  signal,
  viewChild,
} from '@angular/core';
import {
  DATE_PRESETS,
  DatePreset,
  DateRange,
  dayCount,
  formatRange,
  matchPreset,
  todayIso,
} from '../../utils/dates';
import { Icon } from '../icon/icon';

const MAX_SPAN_DAYS = 1830;

let nextId = 0;

@Component({
  selector: 'app-date-range-filter',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
    '(focusout)': 'onFocusOut($event)',
    '(window:focus)': 'refreshToday()',
  },
  templateUrl: './date-range-filter.html',
  styleUrl: './date-range-filter.css',
})
export class DateRangeFilter {
  readonly range = model.required<DateRange>();

  protected readonly presets = DATE_PRESETS;
  protected readonly open = signal(false);
  protected readonly draftFrom = signal('');
  protected readonly draftTo = signal('');
  protected readonly errorId = `date-range-error-${nextId++}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  private readonly chosenPresetId = signal<string | null>(null);

  private readonly today = signal(todayIso());

  private readonly activePreset = computed(() => {
    this.today();
    const range = this.range();
    const chosen = DATE_PRESETS.find((preset) => preset.id === this.chosenPresetId());

    if (chosen) {
      const candidate = chosen.range();

      if (candidate.from === range.from && candidate.to === range.to) {
        return chosen;
      }
    }

    return matchPreset(range);
  });

  protected readonly activePresetId = computed(() => this.activePreset()?.id ?? null);

  protected readonly presetLabel = computed(() => this.activePreset()?.label ?? 'Custom range');

  protected readonly rangeLabel = computed(() => formatRange(this.range()));

  protected readonly customError = computed(() => {
    const from = this.draftFrom();
    const to = this.draftTo();

    if (!from || !to) {
      return 'Choose both dates.';
    }

    if (to < from) {
      return 'The end date cannot fall before the start date.';
    }

    if (dayCount({ from, to }) > MAX_SPAN_DAYS) {
      return 'A range can cover at most five years.';
    }

    return null;
  });

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }

    this.refreshToday();
    this.draftFrom.set(this.range().from);
    this.draftTo.set(this.range().to);
    this.open.set(true);

    afterNextRender(
      () => {
        const host = this.host.nativeElement;
        const target =
          host.querySelector<HTMLButtonElement>('.preset[aria-pressed="true"]') ??
          host.querySelector<HTMLButtonElement>('.preset');

        target?.focus();
      },
      { injector: this.injector },
    );
  }

  protected close(): void {
    if (!this.open()) {
      return;
    }

    const host = this.host.nativeElement;
    const focusWasInside = host.contains(host.ownerDocument.activeElement);

    this.open.set(false);

    if (focusWasInside) {
      this.trigger().nativeElement.focus();
    }
  }

  protected choose(preset: DatePreset): void {
    this.chosenPresetId.set(preset.id);
    this.range.set(preset.range());
    this.close();
  }

  protected applyCustom(event: Event): void {
    event.preventDefault();

    if (this.customError()) {
      return;
    }

    this.chosenPresetId.set(null);
    this.range.set({ from: this.draftFrom(), to: this.draftTo() });
    this.close();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;

    if (this.open() && next && !this.host.nativeElement.contains(next)) {
      this.open.set(false);
    }
  }

  protected refreshToday(): void {
    this.today.set(todayIso());
  }
}
