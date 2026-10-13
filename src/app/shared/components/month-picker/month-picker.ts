import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  viewChild,
} from '@angular/core';
import { addMonths, currentMonth, formatMonth } from '../../utils/dates';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-month-picker',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './month-picker.html',
  styleUrl: './month-picker.css',
})
export class MonthPicker {

  readonly month = model<string>(currentMonth());

  readonly min = input('2000-01');
  readonly max = input('2100-12');

  protected readonly label = computed(() => formatMonth(this.month()));

  protected readonly isCurrent = computed(() => this.month() === currentMonth());

  protected readonly atMin = computed(() => this.month() <= this.min());
  protected readonly atMax = computed(() => this.month() >= this.max());

  private readonly next = viewChild.required<ElementRef<HTMLButtonElement>>('next');

  protected step(count: number): void {
    this.month.update((month) => {
      const stepped = addMonths(month, count);

      return stepped < this.min() ? this.min() : stepped > this.max() ? this.max() : stepped;
    });
  }

  protected goToCurrent(): void {

    this.next().nativeElement.focus();
    this.month.set(currentMonth());
  }
}
