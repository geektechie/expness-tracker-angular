import { PaymentMethod } from './payment-method';

export interface SpendingSummary {
  from: string;
  to: string;
  dayCount: number;
  currency: string;
  total: number;
  expenseCount: number;
  dailyAverage: number;
  largestExpense: number;
  byCategory: CategoryBreakdownItem[];
  byPaymentMethod: PaymentMethodBreakdownItem[];
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  colorHex: string;
  total: number;
  count: number;
  percentOfTotal: number;
}

export interface PaymentMethodBreakdownItem {
  paymentMethod: PaymentMethod;
  total: number;
  count: number;
  percentOfTotal: number;
}

export type TrendGranularity = 'Daily' | 'Monthly';

export interface SpendingTrend {
  granularity: TrendGranularity;
  from: string;
  to: string;
  currency: string;
  total: number;
  points: TrendPoint[];
}

export interface TrendPoint {
  periodStart: string;
  label: string;
  total: number;
  count: number;
}

export interface BudgetStatus {
  month: string;
  currency: string;
  totalLimit: number;
  totalSpent: number;
  totalRemaining: number;
  daysInMonth: number;
  daysElapsed: number;
  isCurrentMonth: boolean;
  categories: BudgetStatusItem[];
}

export interface BudgetStatusItem {
  categoryId: string;
  categoryName: string;
  colorHex: string;
  limit: number | null;
  spent: number;
  remaining: number | null;
  percentUsed: number | null;
  isOverBudget: boolean;
  projectedSpend: number | null;
}
