import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BudgetStatusItem } from '../../../core/models/report';
import { CategoryChip } from '../../components/category-chip/category-chip';
import { Icon, IconName } from '../../components/icon/icon';
import { formatMoney, formatPercent } from '../../utils/money';

type MeterState = 'on-track' | 'on-pace-to-exceed' | 'near-limit' | 'over' | 'unbudgeted';

interface StateStyle {
  label: string;
  icon: IconName;
}

const STATES: Record<MeterState, StateStyle> = {
  'on-track': { label: 'On track', icon: 'check-circle' },
  'on-pace-to-exceed': { label: 'On pace to exceed', icon: 'trending-up' },
  'near-limit': { label: 'Near limit', icon: 'alert-triangle' },
  over: { label: 'Over budget', icon: 'x-circle' },
  unbudgeted: { label: 'No budget set', icon: 'info' },
};

export const NEAR_LIMIT_PERCENT = 85;

@Component({
  selector: 'app-budget-meter',
  imports: [CategoryChip, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './budget-meter.html',
  styleUrl: './budget-meter.css',
})
export class BudgetMeter {
  readonly item = input.required<BudgetStatusItem>();
  readonly currency = input.required<string>();

  protected readonly state = computed<MeterState>(() => {
    const item = this.item();

    if (item.limit === null) {
      return 'unbudgeted';
    }

    if (item.isOverBudget) {
      return 'over';
    }

    if ((item.percentUsed ?? 0) >= NEAR_LIMIT_PERCENT) {
      return 'near-limit';
    }

    if (item.projectedSpend !== null && item.projectedSpend > item.limit) {
      return 'on-pace-to-exceed';
    }

    return 'on-track';
  });

  protected readonly style = computed(() => STATES[this.state()]);

  protected readonly fillPercent = computed(() =>
    Math.max(0, Math.min(100, this.item().percentUsed ?? 0)),
  );

  protected readonly projectionPercent = computed(() => {
    const { projectedSpend, limit } = this.item();

    if (projectedSpend === null || limit === null || limit <= 0) {
      return null;
    }

    return Math.min(100, (projectedSpend / limit) * 100);
  });

  protected readonly overBy = computed(() => {
    const { spent, limit } = this.item();
    return limit === null ? 0 : Math.max(0, spent - limit);
  });

  protected readonly percentLabel = computed(() => formatPercent(this.item().percentUsed));

  protected readonly valueText = computed(() => {
    const item = this.item();
    return `${this.money(item.spent)} of ${this.money(item.limit)}, ${this.percentLabel()} used, ${this.style().label}`;
  });

  protected money(value: number | null): string {
    return formatMoney(value, this.currency());
  }
}
