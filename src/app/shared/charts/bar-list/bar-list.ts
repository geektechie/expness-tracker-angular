import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatMoney, formatPercent } from '../../utils/money';

export interface BarListItem {

  key: string;
  label: string;
  value: number;

  percent?: number | null;

  detail?: string | null;
  swatchColor?: string | null;
}

let nextBarListId = 0;

interface BarRow extends BarListItem {

  length: number;
  formattedValue: string;
  formattedPercent: string | null;
  isOther: boolean;
}

@Component({
  selector: 'app-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bar-list.html',
  styleUrl: './bar-list.css',
})
export class BarList {
  readonly items = input.required<BarListItem[]>();
  readonly currency = input.required<string>();

  readonly label = input('Breakdown');

  readonly maxRows = input(8);

  protected readonly expanded = signal(false);
  protected readonly listId = `bar-list-${nextBarListId++}`;

  private readonly sorted = computed(() => [...this.items()].sort((a, b) => b.value - a.value));
  private readonly limit = computed(() => Math.max(2, this.maxRows()));

  protected readonly foldable = computed(() => this.sorted().length > this.limit());

  protected readonly toggleLabel = computed(() =>
    this.expanded() ? `Show top ${this.limit() - 1}` : `Show all ${this.sorted().length}`,
  );

  protected readonly rows = computed<BarRow[]>(() => {
    const items = this.sorted();

    const visible: BarListItem[] =
      this.foldable() && !this.expanded() ? foldTail(items, this.limit() - 1) : items;

    const longest = Math.max(0, ...visible.map((item) => item.value));
    const currency = this.currency();

    return visible.map((item) => ({
      ...item,
      length: longest > 0 ? (item.value / longest) * 100 : 0,
      formattedValue: formatMoney(item.value, currency),
      formattedPercent:
        item.percent === null || item.percent === undefined ? null : formatPercent(item.percent),
      isOther: item.key === OTHER_KEY,
    }));
  });

  protected toggleExpanded(): void {
    this.expanded.update((expanded) => !expanded);
  }
}

const OTHER_KEY = '__other__';

function foldTail(sorted: BarListItem[], keep: number): BarListItem[] {
  const head = sorted.slice(0, keep);
  const tail = sorted.slice(keep);

  const other: BarListItem = {
    key: OTHER_KEY,
    label: `Other (${tail.length})`,
    value: tail.reduce((sum, item) => sum + item.value, 0),
    percent: tail.every((item) => item.percent !== null && item.percent !== undefined)
      ? Math.round(tail.reduce((sum, item) => sum + (item.percent ?? 0), 0) * 10) / 10
      : null,
    detail: tail.map((item) => item.label).join(', '),

    swatchColor: head.some((item) => item.swatchColor) ? 'var(--text-muted)' : null,
  };

  return [...head, other];
}
