import { PaymentMethod } from './payment-method';

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  spentOn: string;
  categoryId: string;
  categoryName: string;
  categoryColorHex: string;
  description: string;
  paymentMethod: PaymentMethod;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  amount: number;
  spentOn: string;
  categoryId: string;
  description: string;
  paymentMethod: PaymentMethod;
  notes?: string | null;
}

export interface UpdateExpenseRequest {
  amount?: number;
  spentOn?: string;
  categoryId?: string;
  description?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export type ExpenseSort = 'SpentOnDesc' | 'SpentOnAsc' | 'AmountDesc' | 'AmountAsc' | 'CreatedAtDesc';

export const EXPENSE_SORTS: readonly { value: ExpenseSort; label: string }[] = [
  { value: 'SpentOnDesc', label: 'Newest first' },
  { value: 'SpentOnAsc', label: 'Oldest first' },
  { value: 'AmountDesc', label: 'Largest first' },
  { value: 'AmountAsc', label: 'Smallest first' },
  { value: 'CreatedAtDesc', label: 'Recently added' },
];

export interface ExpenseQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  sort?: ExpenseSort;
}

export const EXPENSE_LIMITS = {
  descriptionMaxLength: 200,
  notesMaxLength: 1000,
  maxAmount: 1_000_000_000,
  maxPageSize: 100,
} as const;
