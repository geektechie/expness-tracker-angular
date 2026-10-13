import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TrendGranularity, TrendPoint } from '../../../core/models/report';
import { Icon } from '../../components/icon/icon';
import { formatDate, formatDayShort, formatMonth, formatMonthShort } from '../../utils/dates';
import { formatMoney } from '../../utils/money';
import { niceTicks } from '../../utils/nice-scale';

const PAD_TOP = 24;

const PAD_BOTTOM = 30;
const PAD_RIGHT = 8;
const MAX_COLUMN_WIDTH = 24;
const DATA_END_RADIUS = 4;

const SURFACE_GAP = 2;

const MIN_COLUMN_WIDTH = 1;

const MIN_COLUMN_HEIGHT = 2;

const TOOLTIP_MIN_WIDTH = 150;
const TOOLTIP_OFFSET = 8;

interface Column {
  index: number;

  bandX: number;
  bandWidth: number;
  centerX: number;
  columnWidth: number;
  top: number;

  drawnIndex: number;
  path: string | null;
}

interface Layout {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  ticks: { y: number; label: string; isBaseline: boolean }[];
  columns: Column[];
  xLabels: { x: number; text: string }[];
  peak: { x: number; y: number; label: string } | null;
}

@Component({
  selector: 'app-column-chart',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './column-chart.html',
  styleUrl: './column-chart.css',
})
export class ColumnChart {
  readonly points = input.required<TrendPoint[]>();
  readonly granularity = input.required<TrendGranularity>();
  readonly currency = input.required<string>();

  readonly height = input(260);

  readonly loading = input(false);

  protected readonly active = signal<number | null>(null);
  protected readonly showTable = signal(false);

  private readonly width = signal(0);
  private readonly canvas = viewChild<ElementRef<HTMLDivElement>>('canvas');
  private readonly tooltipEl = viewChild<ElementRef<HTMLDivElement>>('tooltipBox');

  private readonly tooltipWidth = signal(TOOLTIP_MIN_WIDTH);

  constructor() {
    const destroyRef = inject(DestroyRef);
    const host = inject<ElementRef<HTMLElement>>(ElementRef);

    afterRenderEffect(() => {
      this.tooltip();
      const width = this.tooltipEl()?.nativeElement.offsetWidth ?? 0;

      if (width > 0) {
        this.tooltipWidth.set(width);
      }
    });

    afterNextRender(() => {
      const observer = new ResizeObserver((entries) => {
        const width = Math.floor(entries[0]?.contentRect.width ?? 0);

        if (width !== this.width()) {
          this.width.set(width);
        }
      });

      observer.observe(host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected readonly isEmpty = computed(() => this.points().every((point) => point.total === 0));

  protected readonly layout = computed<Layout | null>(() => {
    const width = this.width();
    const height = this.height();
    const points = this.points();

    if (width <= 0 || points.length === 0) {
      return null;
    }

    const maxValue = Math.max(0, ...points.map((point) => point.total));
    const tickValues = niceTicks(maxValue, 4);
    const yMax = tickValues[tickValues.length - 1] || 1;

    const tickLabels = tickValues.map((value) => formatMoney(value, this.currency(), 'compact'));
    const longestLabel = Math.max(...tickLabels.map((label) => label.length));

    const plotLeft = Math.max(36, Math.ceil(longestLabel * 6.6) + 12);
    const plotRight = width - PAD_RIGHT;
    const plotTop = PAD_TOP;
    const plotBottom = height - PAD_BOTTOM;
    const plotHeight = plotBottom - plotTop;
    const plotWidth = Math.max(1, plotRight - plotLeft);

    const y = (value: number): number => plotBottom - (value / yMax) * plotHeight;

    const pointWidth = plotWidth / points.length;
    const groupSize = Math.max(1, Math.ceil((MIN_COLUMN_WIDTH + SURFACE_GAP) / pointWidth));

    const columns: Column[] = [];

    for (let start = 0; start < points.length; start += groupSize) {
      const end = Math.min(points.length, start + groupSize);
      const bandX = plotLeft + start * pointWidth;
      const bandWidth = (end - start) * pointWidth;
      const centerX = bandX + bandWidth / 2;
      const columnWidth = Math.max(
        MIN_COLUMN_WIDTH,
        Math.min(MAX_COLUMN_WIDTH, bandWidth * 0.64, bandWidth - SURFACE_GAP),
      );

      let drawnIndex = start;
      for (let index = start + 1; index < end; index++) {
        if (points[index].total > points[drawnIndex].total) {
          drawnIndex = index;
        }
      }

      const drawnTotal = points[drawnIndex].total;
      const barHeight = Math.max(MIN_COLUMN_HEIGHT, plotBottom - y(drawnTotal));
      const path =
        drawnTotal > 0
          ? columnPath(centerX - columnWidth / 2, plotBottom - barHeight, columnWidth, barHeight)
          : null;

      for (let index = start; index < end; index++) {
        columns.push({
          index,
          bandX,
          bandWidth,
          centerX,
          columnWidth,
          top: y(points[index].total),
          drawnIndex,
          path: index === drawnIndex ? path : null,
        });
      }
    }

    const peakIndex = maxValue > 0 ? points.findIndex((point) => point.total === maxValue) : -1;
    const peakColumn = peakIndex >= 0 ? columns[peakIndex] : null;

    return {
      width,
      height,
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      ticks: tickValues.map((value, index) => ({
        y: Math.round(y(value)) + 0.5,
        label: tickLabels[index],
        isBaseline: value === 0,
      })),
      columns,
      xLabels: this.thinnedXLabels(points, columns, plotWidth),
      peak: peakColumn
        ? {
            x: clamp(peakColumn.centerX, plotLeft + 24, plotRight - 24),
            y: peakColumn.top - 7,
            label: formatMoney(maxValue, this.currency(), 'compact'),
          }
        : null,
    };
  });

  protected readonly activeColumn = computed(() => {
    const index = this.active();
    return index === null ? null : (this.layout()?.columns[index] ?? null);
  });

  protected readonly tooltip = computed(() => {
    const layout = this.layout();
    const column = this.activeColumn();

    if (!layout || !column) {
      return null;
    }

    const point = this.points()[column.index];
    const tipWidth = this.tooltipWidth();

    const offset = column.columnWidth / 2 + TOOLTIP_OFFSET;
    const rightX = column.centerX + offset;
    const leftX = column.centerX - offset - tipWidth;
    const fitsRight = rightX + tipWidth <= layout.width;
    const fitsLeft = leftX >= 0;
    const preferLeft = column.centerX > (layout.plotLeft + layout.plotRight) / 2;
    const toLeft = preferLeft ? fitsLeft || !fitsRight : fitsLeft && !fitsRight;

    return {
      x: clamp(toLeft ? leftX : rightX, 0, Math.max(0, layout.width - tipWidth)),
      y: layout.plotTop + 4,
      value: this.money(point.total),
      period: this.periodLabel(point),
      count: countLabel(point.count),
    };
  });

  protected readonly ariaLabel = computed(() => {
    const points = this.points();

    if (points.length === 0) {
      return 'Spending chart: no data';
    }

    const unit = this.granularity() === 'Monthly' ? 'month' : 'day';
    const total = points.reduce((sum, point) => sum + point.total, 0);

    return (
      `Spending per ${unit}, ${this.periodLabel(points[0])} to ${this.periodLabel(points[points.length - 1])}. ` +
      `Total ${this.money(total)}. Use the arrow keys to read each ${unit}.`
    );
  });

  protected readonly liveText = computed(() => {
    const index = this.active();

    if (index === null) {
      return '';
    }

    const point = this.points()[index];
    return point ? `${this.periodLabel(point)}: ${this.money(point.total)}, ${countLabel(point.count)}` : '';
  });

  protected onPointerMove(event: PointerEvent): void {
    const layout = this.layout();
    const canvas = this.canvas()?.nativeElement;

    if (!layout || !canvas) {
      return;
    }

    const x = event.clientX - canvas.getBoundingClientRect().left;

    if (x < layout.plotLeft || x > layout.plotRight) {
      this.active.set(null);
      return;
    }

    const pointWidth = (layout.plotRight - layout.plotLeft) / this.points().length;
    const index = clamp(Math.floor((x - layout.plotLeft) / pointWidth), 0, this.points().length - 1);

    this.active.set(layout.columns[index]?.drawnIndex ?? index);
  }

  protected onPointerLeave(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      this.active.set(null);
    }
  }

  protected onFocus(): void {
    if (this.active() !== null) {
      return;
    }

    const points = this.points();
    let index = points.length - 1;

    while (index > 0 && points[index].total === 0) {
      index--;
    }

    this.active.set(points.length > 0 ? index : null);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.points().length - 1;
    const current = this.active() ?? last;

    const next =
      event.key === 'ArrowRight'
        ? Math.min(last, current + 1)
        : event.key === 'ArrowLeft'
          ? Math.max(0, current - 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;

    if (next !== null) {
      event.preventDefault();
      this.active.set(next);
    }
  }

  protected toggleTable(): void {
    this.active.set(null);
    this.showTable.update((showing) => !showing);
  }

  protected periodLabel(point: TrendPoint): string {
    return this.granularity() === 'Monthly' ? formatMonth(point.label) : formatDate(point.periodStart);
  }

  protected money(value: number): string {
    return formatMoney(value, this.currency());
  }

  private thinnedXLabels(
    points: TrendPoint[],
    columns: Column[],
    plotWidth: number,
  ): { x: number; text: string }[] {
    const monthly = this.granularity() === 'Monthly';
    const labelWidth = monthly ? 68 : 50;
    const maxLabels = Math.max(2, Math.floor(plotWidth / labelWidth));
    const step = Math.max(1, Math.ceil(points.length / maxLabels));

    return points
      .map((point, index) => ({ point, index }))
      .filter(({ index }) => index % step === 0)
      .map(({ point, index }) => ({
        x: columns[index].centerX,
        text: monthly ? formatMonthShort(point.label) : formatDayShort(point.periodStart),
      }));
  }
}

function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(DATA_END_RADIUS, width / 2, height);

  return (
    `M${x},${y + height}` +
    `V${y + r}` +
    `A${r},${r} 0 0 1 ${x + r},${y}` +
    `H${x + width - r}` +
    `A${r},${r} 0 0 1 ${x + width},${y + r}` +
    `V${y + height}Z`
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function countLabel(count: number): string {
  return count === 0 ? 'No expenses' : count === 1 ? '1 expense' : `${count} expenses`;
}
