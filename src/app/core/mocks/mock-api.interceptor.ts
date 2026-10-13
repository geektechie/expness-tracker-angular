import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpParams,
  HttpResponse,
} from '@angular/common/http';
import { delay, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Budget } from '../models/budget';
import { Category } from '../models/category';
import { Expense, ExpenseSort } from '../models/expense';
import { PagedResult } from '../models/paged-result';
import { PaymentMethod } from '../models/payment-method';
import {
  BudgetStatus,
  BudgetStatusItem,
  SpendingSummary,
  SpendingTrend,
  TrendGranularity,
  TrendPoint,
} from '../models/report';
import { MOCK_BUDGETS, MOCK_CATEGORIES, MOCK_EXPENSES } from './mock-data';

const MOCK_DELAY_MS = 350;

let categories: Category[] = MOCK_CATEGORIES.map((c) => ({ ...c }));
let expenses: Expense[] = MOCK_EXPENSES.map((e) => ({ ...e }));
let budgets: Budget[] = MOCK_BUDGETS.map((b) => ({ ...b }));

export function resetMockData(): void {
  categories = MOCK_CATEGORIES.map((c) => ({ ...c }));
  expenses = MOCK_EXPENSES.map((e) => ({ ...e }));
  budgets = MOCK_BUDGETS.map((b) => ({ ...b }));
}

export const mockApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!environment.useMockApi || !isMockedUrl(request.url)) {
    return next(request);
  }

  try {
    const response = handleMockRequest(
      request.method.toUpperCase(),
      stripBaseUrl(request.url),
      request.params,
      request.body as Record<string, unknown> | null,
    );
    return of(response).pipe(delay(MOCK_DELAY_MS));
  } catch (error) {
    const status = error instanceof HttpErrorResponse ? error : notFound();
    return throwError(() => status).pipe(delay(MOCK_DELAY_MS));
  }
};

function isMockedUrl(url: string): boolean {
  const base = (environment.apiBaseUrl || '/api').replace(/\/+$/, '');
  return url === base || url.startsWith(`${base}/`);
}

function stripBaseUrl(url: string): string {
  const base = (environment.apiBaseUrl || '/api').replace(/\/+$/, '');
  const path = url.startsWith(base) ? url.slice(base.length) : url;
  return path.startsWith('/') ? path : `/${path}`;
}

function handleMockRequest(
  method: string,
  path: string,
  params: HttpParams,
  body: Record<string, unknown> | null,
): HttpResponse<unknown> {
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);

  if (segments[0] === 'categories') {
    return handleCategories(method, segments.slice(1), params, body);
  }
  if (segments[0] === 'expenses') {
    return handleExpenses(method, segments.slice(1), params, body);
  }
  if (segments[0] === 'budgets') {
    return handleBudgets(method, segments.slice(1), body);
  }
  if (segments[0] === 'reports') {
    return handleReports(segments.slice(1), params);
  }

  throw notFound();
}

function handleCategories(
  method: string,
  rest: string[],
  params: HttpParams,
  body: Record<string, unknown> | null,
): HttpResponse<unknown> {
  if (rest.length === 0) {
    if (method === 'GET') {
      const includeArchived = params.get('includeArchived') === 'true';
      const items = includeArchived ? categories : categories.filter((c) => !c.isArchived);
      return ok(sortByName(items));
    }
    if (method === 'POST') {
      const name = String(body?.['name'] ?? '').trim();
      const colorHex = String(body?.['colorHex'] ?? '#6b7280');
      if (!name) {
        throw badRequest('The request was not valid.', 'Name is required.');
      }
      const now = new Date().toISOString();
      const created: Category = {
        id: newGuid(),
        name,
        colorHex,
        isArchived: false,
        expenseCount: 0,
        createdAt: now,
      };
      categories = [...categories, created];
      return createdResponse(created);
    }
  }

  if (rest.length === 1) {
    const existing = categories.find((c) => c.id === rest[0]);
    if (!existing) {
      throw notFound('That item no longer exists.');
    }
    if (method === 'GET') {
      return ok(existing);
    }
    if (method === 'PUT') {
      const updated: Category = {
        ...existing,
        name: body?.['name'] !== undefined ? String(body['name']) : existing.name,
        colorHex: body?.['colorHex'] !== undefined ? String(body['colorHex']) : existing.colorHex,
        isArchived:
          body?.['isArchived'] !== undefined ? Boolean(body['isArchived']) : existing.isArchived,
      };
      categories = categories.map((c) => (c.id === updated.id ? updated : c));
      return ok(updated);
    }
    if (method === 'DELETE') {
      categories = categories.filter((c) => c.id !== existing.id);
      return noContent();
    }
  }

  throw notFound();
}

function handleExpenses(
  method: string,
  rest: string[],
  params: HttpParams,
  body: Record<string, unknown> | null,
): HttpResponse<unknown> {
  if (rest.length === 0) {
    if (method === 'GET') {
      return ok(listExpenses(params));
    }
    if (method === 'POST') {
      const now = new Date().toISOString();
      const spentOn = String(body?.['spentOn'] ?? todayLocalIso());
      const categoryId = String(body?.['categoryId'] ?? '');
      const category = categories.find((c) => c.id === categoryId) ?? categories[0];
      const created: Expense = {
        id: newGuid(),
        amount: Number(body?.['amount'] ?? 0),
        currency: 'USD',
        spentOn,
        categoryId: category.id,
        categoryName: category.name,
        categoryColorHex: category.colorHex,
        description: String(body?.['description'] ?? ''),
        paymentMethod: (body?.['paymentMethod'] as PaymentMethod) ?? 'Cash',
        notes: (body?.['notes'] as string | null) ?? null,
        createdAt: now,
        updatedAt: now,
      };
      expenses = [created, ...expenses];
      refreshCategoryCounts();
      return createdResponse(created);
    }
  }

  if (rest.length === 1) {
    const existing = expenses.find((e) => e.id === rest[0]);
    if (!existing) {
      throw notFound('That item no longer exists.');
    }
    if (method === 'GET') {
      return ok(existing);
    }
    if (method === 'PUT') {
      const categoryId =
        body?.['categoryId'] !== undefined ? String(body['categoryId']) : existing.categoryId;
      const category = categories.find((c) => c.id === categoryId) ?? categories[0];
      const updated: Expense = {
        ...existing,
        amount: body?.['amount'] !== undefined ? Number(body['amount']) : existing.amount,
        spentOn: body?.['spentOn'] !== undefined ? String(body['spentOn']) : existing.spentOn,
        categoryId: category.id,
        categoryName: category.name,
        categoryColorHex: category.colorHex,
        description:
          body?.['description'] !== undefined
            ? String(body['description'])
            : existing.description,
        paymentMethod:
          body?.['paymentMethod'] !== undefined
            ? (body['paymentMethod'] as PaymentMethod)
            : existing.paymentMethod,
        notes: body?.['notes'] !== undefined ? (body['notes'] as string | null) : existing.notes,
        updatedAt: new Date().toISOString(),
      };
      expenses = expenses.map((e) => (e.id === updated.id ? updated : e));
      refreshCategoryCounts();
      return ok(updated);
    }
    if (method === 'DELETE') {
      expenses = expenses.filter((e) => e.id !== existing.id);
      refreshCategoryCounts();
      return noContent();
    }
  }

  throw notFound();
}

function listExpenses(params: HttpParams): PagedResult<Expense> {
  const from = params.get('from') || undefined;
  const to = params.get('to') || undefined;
  const categoryId = params.get('categoryId') || undefined;
  const paymentMethod = (params.get('paymentMethod') || undefined) as PaymentMethod | undefined;
  const minAmount = toNumber(params.get('minAmount'));
  const maxAmount = toNumber(params.get('maxAmount'));
  const search = (params.get('search') || '').trim().toLowerCase();
  const sort = (params.get('sort') || 'SpentOnDesc') as ExpenseSort;
  const page = Math.max(1, toNumber(params.get('page')) ?? 1);
  const pageSize = Math.min(100, Math.max(1, toNumber(params.get('pageSize')) ?? 25));

  let items = [...expenses];
  if (from) {
    items = items.filter((e) => e.spentOn >= from);
  }
  if (to) {
    items = items.filter((e) => e.spentOn <= to);
  }
  if (categoryId) {
    items = items.filter((e) => e.categoryId === categoryId);
  }
  if (paymentMethod) {
    items = items.filter((e) => e.paymentMethod === paymentMethod);
  }
  if (minAmount !== null) {
    items = items.filter((e) => e.amount >= minAmount);
  }
  if (maxAmount !== null) {
    items = items.filter((e) => e.amount <= maxAmount);
  }
  if (search) {
    items = items.filter(
      (e) =>
        e.description.toLowerCase().includes(search) ||
        (e.notes ?? '').toLowerCase().includes(search),
    );
  }

  items.sort(expenseComparator(sort));

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = page > totalPages ? [] : items.slice(start, start + pageSize);

  return {
    items: page > totalPages ? [] : pageItems,
    page: page > totalPages ? page : safePage,
    pageSize,
    totalCount,
    totalPages,
    hasPrevious: (page > totalPages ? page : safePage) > 1,
    hasNext: (page > totalPages ? page : safePage) < totalPages,
  };
}

function expenseComparator(sort: ExpenseSort): (a: Expense, b: Expense) => number {
  switch (sort) {
    case 'SpentOnAsc':
      return (a, b) => a.spentOn.localeCompare(b.spentOn) || b.createdAt.localeCompare(a.createdAt);
    case 'AmountDesc':
      return (a, b) => b.amount - a.amount;
    case 'AmountAsc':
      return (a, b) => a.amount - b.amount;
    case 'CreatedAtDesc':
      return (a, b) => b.createdAt.localeCompare(a.createdAt);
    case 'SpentOnDesc':
    default:
      return (a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt);
  }
}

function handleBudgets(
  method: string,
  rest: string[],
  body: Record<string, unknown> | null,
): HttpResponse<unknown> {

  if (rest.length === 0 && method === 'PUT') {
    const categoryId = String(body?.['categoryId'] ?? '');
    const month = String(body?.['month'] ?? '');
    const limit = Number(body?.['limit'] ?? NaN);
    const category = categories.find((c) => c.id === categoryId);
    if (!category || !/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(limit)) {
      throw badRequest('The request was not valid.', 'categoryId, month and limit are required.');
    }
    const existing = budgets.find((b) => b.categoryId === categoryId && b.month === month);
    const now = new Date().toISOString();
    if (existing) {
      const updated: Budget = { ...existing, limit, updatedAt: now };
      budgets = budgets.map((b) => (b.id === updated.id ? updated : b));
      return ok(updated);
    }
    const created: Budget = {
      id: newGuid(),
      categoryId: category.id,
      categoryName: category.name,
      categoryColorHex: category.colorHex,
      month,
      limit,
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    };
    budgets = [...budgets, created];
    return ok(created);
  }

  if (rest.length === 1) {
    if (method === 'GET' && /^\d{4}-\d{2}$/.test(rest[0])) {
      return ok(budgets.filter((b) => b.month === rest[0]).sort((a, b) => a.categoryName.localeCompare(b.categoryName)));
    }
    if (method === 'DELETE') {
      const existing = budgets.find((b) => b.id === rest[0]);
      if (!existing) {
        throw notFound('That item no longer exists.');
      }
      budgets = budgets.filter((b) => b.id !== existing.id);
      return noContent();
    }
  }

  throw notFound();
}

function handleReports(rest: string[], params: HttpParams): HttpResponse<unknown> {
  if (rest[0] === 'summary') {
    return ok(buildSummary(params.get('from') || undefined, params.get('to') || undefined));
  }
  if (rest[0] === 'trend') {
    const granularity = (params.get('granularity') || 'Daily') as TrendGranularity;
    return ok(
      buildTrend(granularity, params.get('from') || undefined, params.get('to') || undefined),
    );
  }
  if (rest[0] === 'budget-status') {
    return ok(buildBudgetStatus(params.get('month') || currentMonthLocal()));
  }
  throw notFound();
}

function filteredByRange(from?: string, to?: string): Expense[] {
  return expenses.filter(
    (e) => (!from || e.spentOn >= from) && (!to || e.spentOn <= to),
  );
}

function buildSummary(from?: string, to?: string): SpendingSummary {
  const range = resolveRange(from, to);
  const items = filteredByRange(range.from, range.to);
  const total = round2(items.reduce((sum, e) => sum + e.amount, 0));
  const largestExpense = items.length > 0 ? Math.max(...items.map((e) => e.amount)) : 0;

  const byCategoryMap = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    const entry = byCategoryMap.get(item.categoryId) ?? { total: 0, count: 0 };
    entry.total += item.amount;
    entry.count += 1;
    byCategoryMap.set(item.categoryId, entry);
  }
  const byCategory = [...byCategoryMap.entries()]
    .map(([categoryId, entry]) => {
      const first = items.find((e) => e.categoryId === categoryId) ?? expenses.find((e) => e.categoryId === categoryId);
      return {
        categoryId,
        categoryName: first?.categoryName ?? 'Unknown',
        colorHex: first?.categoryColorHex ?? '#6b7280',
        total: round2(entry.total),
        count: entry.count,
        percentOfTotal: total > 0 ? round1((entry.total / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  const byMethodMap = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    const entry = byMethodMap.get(item.paymentMethod) ?? { total: 0, count: 0 };
    entry.total += item.amount;
    entry.count += 1;
    byMethodMap.set(item.paymentMethod, entry);
  }
  const byPaymentMethod = [...byMethodMap.entries()]
    .map(([paymentMethod, entry]) => ({
      paymentMethod: paymentMethod as PaymentMethod,
      total: round2(entry.total),
      count: entry.count,
      percentOfTotal: total > 0 ? round1((entry.total / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    from: range.from,
    to: range.to,
    dayCount: dayCountInclusive(range.from, range.to),
    currency: 'USD',
    total,
    expenseCount: items.length,
    dailyAverage: range ? round2(total / Math.max(1, dayCountInclusive(range.from, range.to))) : total,
    largestExpense,
    byCategory,
    byPaymentMethod,
  };
}

function buildTrend(granularity: TrendGranularity, from?: string, to?: string): SpendingTrend {
  const range = resolveRange(from, to);
  const items = filteredByRange(range.from, range.to);
  let points: TrendPoint[] = [];

  if (granularity === 'Monthly') {
    const groups = new Map<string, Expense[]>();
    for (const item of items) {
      const month = item.spentOn.slice(0, 7);
      groups.set(month, [...(groups.get(month) ?? []), item]);
    }
    const months = monthsBetween(range.from.slice(0, 7), range.to.slice(0, 7));
    points = months.map((month) => {
      const group = groups.get(month) ?? [];
      return {
        periodStart: `${month}-01`,
        label: monthLabelShort(month),
        total: round2(group.reduce((sum, e) => sum + e.amount, 0)),
        count: group.length,
      };
    });
  } else {
    const days = daysBetween(range.from, range.to);
    points = days.map((day) => {
      const group = items.filter((e) => e.spentOn === day);
      return {
        periodStart: day,
        label: dayLabelShort(day),
        total: round2(group.reduce((sum, e) => sum + e.amount, 0)),
        count: group.length,
      };
    });
  }

  return {
    granularity,
    from: range.from,
    to: range.to,
    currency: 'USD',
    total: round2(points.reduce((sum, p) => sum + p.total, 0)),
    points,
  };
}

function buildBudgetStatus(month: string): BudgetStatus {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const today = todayLocalIso();
  const currentMonth = today.slice(0, 7);
  const isCurrentMonth = month === currentMonth;
  const daysElapsed = isCurrentMonth
    ? Number(today.slice(8, 10))
    : month > currentMonth
      ? 0
      : daysInMonth;

  const monthExpenses = expenses.filter((e) => e.spentOn.slice(0, 7) === month);
  const spentByCategory = new Map<string, number>();
  for (const item of monthExpenses) {
    spentByCategory.set(item.categoryId, (spentByCategory.get(item.categoryId) ?? 0) + item.amount);
  }

  const monthBudgets = budgets.filter((b) => b.month === month);
  const seen = new Set<string>();
  const items: BudgetStatusItem[] = [];

  for (const budget of monthBudgets) {
    seen.add(budget.categoryId);
    const spent = round2(spentByCategory.get(budget.categoryId) ?? 0);
    items.push(toBudgetStatusItem(budget.categoryId, budget.categoryName, budget.categoryColorHex, budget.limit, spent, daysElapsed, daysInMonth, isCurrentMonth));
  }
  for (const [categoryId, spentRaw] of spentByCategory) {
    if (seen.has(categoryId)) {
      continue;
    }
    const first = monthExpenses.find((e) => e.categoryId === categoryId);
    const fallback = categories.find((c) => c.id === categoryId);
    items.push(
      toBudgetStatusItem(
        categoryId,
        first?.categoryName ?? fallback?.name ?? 'Unknown',
        first?.categoryColorHex ?? fallback?.colorHex ?? '#6b7280',
        null,
        round2(spentRaw),
        daysElapsed,
        daysInMonth,
        isCurrentMonth,
      ),
    );
  }

  items.sort((a, b) => b.spent - a.spent);

  const totalLimit = round2(monthBudgets.reduce((sum, b) => sum + b.limit, 0));
  const totalSpent = round2(monthExpenses.reduce((sum, e) => sum + e.amount, 0));

  return {
    month,
    currency: 'USD',
    totalLimit,
    totalSpent,
    totalRemaining: Math.max(0, round2(totalLimit - totalSpent)),
    daysInMonth,
    daysElapsed,
    isCurrentMonth,
    categories: items,
  };
}

function toBudgetStatusItem(
  categoryId: string,
  categoryName: string,
  colorHex: string,
  limit: number | null,
  spent: number,
  daysElapsed: number,
  daysInMonth: number,
  isCurrentMonth: boolean,
): BudgetStatusItem {
  const remaining = limit === null ? null : round2(limit - spent);
  const percentUsed = limit === null || limit === 0 ? null : round1((spent / limit) * 100);
  const projectedSpend =
    isCurrentMonth && daysElapsed > 0 ? round2((spent / daysElapsed) * daysInMonth) : null;
  return {
    categoryId,
    categoryName,
    colorHex,
    limit,
    spent,
    remaining,
    percentUsed,
    isOverBudget: limit !== null && spent > limit,
    projectedSpend,
  };
}

function ok(body: unknown): HttpResponse<unknown> {
  return new HttpResponse({ status: 200, body });
}

function createdResponse(body: unknown): HttpResponse<unknown> {
  return new HttpResponse({ status: 201, body });
}

function noContent(): HttpResponse<unknown> {
  return new HttpResponse({ status: 204, body: null });
}

function notFound(message = 'That item no longer exists.'): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 404,
    statusText: 'Not Found',
    url: undefined,
    error: { title: message, status: 404 },
  });
}

function badRequest(title: string, detail: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 400,
    statusText: 'Bad Request',
    url: undefined,
    error: { title, detail, status: 400 },
  });
}

function toNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortByName(items: Category[]): Category[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function refreshCategoryCounts(): void {
  const counts = new Map<string, number>();
  for (const item of expenses) {
    counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
  }
  categories = categories.map((c) => ({ ...c, expenseCount: counts.get(c.id) ?? 0 }));
}

function newGuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function resolveRange(from?: string, to?: string): { from: string; to: string } {
  const today = todayLocalIso();
  if (from && to) {
    return { from, to };
  }
  if (from) {
    return { from, to: today };
  }
  if (to) {
    return { from: to.slice(0, 7) + '-01', to };
  }
  const month = today.slice(0, 7);
  return { from: `${month}-01`, to: `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}` };
}

function dayCountInclusive(from: string, to: string): number {
  const ms = Date.parse(to) - Date.parse(from);
  return Math.round(ms / 86_400_000) + 1;
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const current = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  for (let i = 0; i < 366 && current <= end; i++) {
    days.push(toLocalIso(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const months: string[] = [];
  let [year, month] = fromMonth.split('-').map(Number);
  const [endYear, endMonth] = toMonth.split('-').map(Number);
  for (let i = 0; i < 36; i++) {
    const label = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
    months.push(label);
    if (year === endYear && month === endMonth) {
      break;
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function monthLabelShort(month: string): string {
  const [, m] = month.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[(m ?? 1) - 1]} ${month.slice(0, 4)}`;
}

function dayLabelShort(iso: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, m, d] = iso.split('-').map(Number);
  return `${months[(m ?? 1) - 1]} ${d ?? 1}`;
}

function todayLocalIso(): string {
  const now = new Date();
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toLocalIso(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentMonthLocal(): string {
  return todayLocalIso().slice(0, 7);
}

function round2(value: number): number {
  return Math.round(Number((value * 100).toFixed(6))) / 100;
}

function round1(value: number): number {
  return Math.round(Number((value * 10).toFixed(6))) / 10;
}
