import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const rect = (x: number, y: number, w: number, h: number, r = 0): string =>
  r === 0
    ? `M${x} ${y}h${w}v${h}h${-w}z`
    : `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
      `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const ICONS = {
  dashboard: [rect(3, 3, 7, 9, 1.5), rect(14, 3, 7, 5, 1.5), rect(14, 12, 7, 9, 1.5), rect(3, 16, 7, 5, 1.5)],
  receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2V3z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
  tag: ['M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7l8.8 8.8-9.2 9.2L3 12.2z', circle(7.75, 7.75, 1.5)],
  target: [circle(12, 12, 9), circle(12, 12, 5), circle(12, 12, 1)],
  chart: ['M4 20h16', 'M7 16v-5', 'M12 16V6', 'M17 16v-8'],
  wallet: [rect(3, 6, 18, 14, 2.5), 'M3 10h14.5a3.5 3.5 0 0 1 0 7H16', 'M7 6l9-3 1.5 3'],
  plus: ['M12 5v14', 'M5 12h14'],
  pencil: ['M4 20l1.2-4.6L16.6 4a1.9 1.9 0 0 1 2.7 0l.7.7a1.9 1.9 0 0 1 0 2.7L8.6 18.8 4 20z', 'M14.5 6.1l3.4 3.4'],
  trash: ['M4 7h16', 'M9.5 11v6', 'M14.5 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  archive: [rect(3, 4, 18, 4, 1), 'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8', 'M10 12h4'],
  restore: ['M4 4v6h6', 'M4.6 10a8 8 0 1 1 1.9 7.4'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  'check-circle': [circle(12, 12, 9), 'M8 12.5l2.7 2.7L16 9.8'],
  'alert-triangle': ['M12 3.5 2.5 20h19L12 3.5z', 'M12 10v4.5', 'M12 17.25v.01'],
  'x-circle': [circle(12, 12, 9), 'M9 9l6 6', 'M15 9l-6 6'],
  info: [circle(12, 12, 9), 'M12 11v5', 'M12 8v.01'],
  x: ['M6 6l12 12', 'M18 6 6 18'],
  'chevron-left': ['M15 6l-6 6 6 6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  search: [circle(11, 11, 6.5), 'M16 16l4.5 4.5'],
  calendar: [rect(3, 5, 18, 16, 2), 'M3 10h18', 'M8 3v4', 'M16 3v4'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
  sun: [circle(12, 12, 4), 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  monitor: [rect(3, 4, 18, 12, 2), 'M8 20h8', 'M12 16v4'],
  table: [rect(3, 4, 18, 16, 2), 'M3 10h18', 'M3 15h18', 'M10 10v10'],
  'trending-up': ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.html',
  styleUrl: './icon.css',
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly strokeWidth = input(1.75);
  readonly label = input<string | null>(null);

  protected readonly paths = computed(() => ICONS[this.name()]);
}
