import { Budget } from '../models/budget';
import { Category } from '../models/category';
import { Expense } from '../models/expense';

export const MOCK_CATEGORIES: Category[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Groceries',
    colorHex: '#22c55e',
    isArchived: false,
    expenseCount: 8,
    createdAt: '2026-08-02T09:12:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Dining Out',
    colorHex: '#f97316',
    isArchived: false,
    expenseCount: 6,
    createdAt: '2026-08-03T09:12:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Transport',
    colorHex: '#3b82f6',
    isArchived: false,
    expenseCount: 5,
    createdAt: '2026-08-04T09:12:00Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Utilities',
    colorHex: '#8b5cf6',
    isArchived: false,
    expenseCount: 3,
    createdAt: '2026-08-05T09:12:00Z',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Entertainment',
    colorHex: '#ec4899',
    isArchived: false,
    expenseCount: 4,
    createdAt: '2026-08-06T09:12:00Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Shopping',
    colorHex: '#eab308',
    isArchived: false,
    expenseCount: 3,
    createdAt: '2026-08-07T09:12:00Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    name: 'Health',
    colorHex: '#14b8a6',
    isArchived: false,
    expenseCount: 2,
    createdAt: '2026-08-08T09:12:00Z',
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    name: 'Travel',
    colorHex: '#6b7280',
    isArchived: true,
    expenseCount: 1,
    createdAt: '2026-08-09T09:12:00Z',
  },
];

function expense(
  id: string,
  spentOn: string,
  categoryId: string,
  description: string,
  amount: number,
  paymentMethod: Expense['paymentMethod'],
  notes: string | null = null,
): Expense {
  const category = MOCK_CATEGORIES.find((c) => c.id === categoryId) ?? MOCK_CATEGORIES[0];
  return {
    id,
    amount,
    currency: 'USD',
    spentOn,
    categoryId: category.id,
    categoryName: category.name,
    categoryColorHex: category.colorHex,
    description,
    paymentMethod,
    notes,
    createdAt: `${spentOn}T10:00:00Z`,
    updatedAt: `${spentOn}T10:00:00Z`,
  };
}

export const MOCK_EXPENSES: Expense[] = [
  expense('a1111111-1111-4111-a111-111111111111', '2026-10-12', MOCK_CATEGORIES[0].id, 'Weekly supermarket run', 86.4, 'DebitCard'),
  expense('a2222222-2222-4222-a222-222222222222', '2026-10-11', MOCK_CATEGORIES[1].id, 'Pizza night with friends', 42.5, 'CreditCard'),
  expense('a3333333-3333-4333-a333-333333333333', '2026-10-10', MOCK_CATEGORIES[2].id, 'Monthly metro pass', 60.0, 'BankTransfer'),
  expense('a4444444-4444-4444-a444-444444444444', '2026-10-09', MOCK_CATEGORIES[0].id, 'Fresh vegetables market', 24.75, 'Cash'),
  expense('a5555555-5555-4555-a555-555555555555', '2026-10-08', MOCK_CATEGORIES[4].id, 'Cinema tickets', 28.0, 'CreditCard'),
  expense('a6666666-6666-4666-a666-666666666666', '2026-10-07', MOCK_CATEGORIES[1].id, 'Morning coffee and bagel', 8.9, 'DigitalWallet'),
  expense('a7777777-7777-4777-a777-777777777777', '2026-10-06', MOCK_CATEGORIES[6].id, 'Pharmacy refill', 32.2, 'DebitCard'),
  expense('a8888888-8888-4888-a888-888888888888', '2026-10-05', MOCK_CATEGORIES[5].id, 'New running shoes', 95.0, 'CreditCard', 'Autumn sale discount applied'),
  expense('a9999999-9999-4999-a999-999999999999', '2026-10-04', MOCK_CATEGORIES[3].id, 'Electricity bill', 74.3, 'DirectDebit'),
  expense('b1111111-1111-4111-b111-111111111111', '2026-10-03', MOCK_CATEGORIES[0].id, 'Bulk rice and pasta', 45.6, 'DebitCard'),
  expense('b2222222-2222-4222-b222-222222222222', '2026-10-02', MOCK_CATEGORIES[2].id, 'Taxi to airport', 22.0, 'DigitalWallet'),
  expense('b3333333-3333-4333-b333-333333333333', '2026-10-01', MOCK_CATEGORIES[1].id, 'Lunch at downtown cafe', 18.75, 'Cash'),
  expense('b4444444-4444-4444-b444-444444444444', '2026-09-28', MOCK_CATEGORIES[0].id, 'Weekly supermarket run', 92.1, 'DebitCard'),
  expense('b5555555-5555-4555-b555-555555555555', '2026-09-25', MOCK_CATEGORIES[4].id, 'Concert tickets', 65.0, 'CreditCard'),
  expense('b6666666-6666-4666-b666-666666666666', '2026-09-22', MOCK_CATEGORIES[3].id, 'Internet bill', 49.99, 'DirectDebit'),
  expense('b7777777-7777-4777-b777-777777777777', '2026-09-20', MOCK_CATEGORIES[5].id, 'Bookstore haul', 38.4, 'DebitCard'),
  expense('b8888888-8888-4888-b888-888888888888', '2026-09-18', MOCK_CATEGORIES[1].id, 'Sushi dinner', 54.2, 'CreditCard'),
  expense('b9999999-9999-4999-b999-999999999999', '2026-09-15', MOCK_CATEGORIES[2].id, 'Fuel refill', 40.0, 'DebitCard'),
  expense('c1111111-1111-4111-c111-111111111111', '2026-09-12', MOCK_CATEGORIES[0].id, 'Bakery and dairy', 19.85, 'Cash'),
  expense('c2222222-2222-4222-c222-222222222222', '2026-09-10', MOCK_CATEGORIES[6].id, 'Dentist checkup', 80.0, 'BankTransfer'),
  expense('c3333333-3333-4333-c333-333333333333', '2026-09-08', MOCK_CATEGORIES[4].id, 'Streaming subscription', 12.99, 'CreditCard'),
  expense('c4444444-4444-4444-c444-444444444444', '2026-09-05', MOCK_CATEGORIES[0].id, 'Weekly supermarket run', 78.3, 'DebitCard'),
  expense('c5555555-5555-4555-c555-555555555555', '2026-09-03', MOCK_CATEGORIES[1].id, 'Brunch with family', 36.7, 'Cash'),
  expense('c6666666-6666-4666-c666-666666666666', '2026-09-01', MOCK_CATEGORIES[3].id, 'Water bill', 28.5, 'DirectDebit'),
  expense('c7777777-7777-4777-c777-777777777777', '2026-08-28', MOCK_CATEGORIES[7].id, 'Train to lakeside cabin', 120.0, 'CreditCard', 'Archived category keeps its history'),
  expense('c8888888-8888-4888-c888-888888888888', '2026-10-12', MOCK_CATEGORIES[2].id, 'Bus top-up', 15.0, 'Cash'),
  expense('c9999999-9999-4999-c999-999999999999', '2026-10-06', MOCK_CATEGORIES[0].id, 'Snacks for office', 12.4, 'DigitalWallet'),
  expense('d1111111-1111-4111-d111-111111111111', '2026-10-11', MOCK_CATEGORIES[4].id, 'Board game night snacks', 21.3, 'Cash'),
];

function budget(
  id: string,
  categoryId: string,
  month: string,
  limit: number,
): Budget {
  const category = MOCK_CATEGORIES.find((c) => c.id === categoryId) ?? MOCK_CATEGORIES[0];
  return {
    id,
    categoryId: category.id,
    categoryName: category.name,
    categoryColorHex: category.colorHex,
    month,
    limit,
    currency: 'USD',
    createdAt: `${month}-01T09:00:00Z`,
    updatedAt: `${month}-01T09:00:00Z`,
  };
}

export const MOCK_BUDGETS: Budget[] = [
  budget('b1000000-0000-4000-8000-000000000001', MOCK_CATEGORIES[0].id, '2026-10', 400),
  budget('b1000000-0000-4000-8000-000000000002', MOCK_CATEGORIES[1].id, '2026-10', 150),
  budget('b1000000-0000-4000-8000-000000000003', MOCK_CATEGORIES[2].id, '2026-10', 120),
  budget('b1000000-0000-4000-8000-000000000004', MOCK_CATEGORIES[3].id, '2026-10', 160),
  budget('b1000000-0000-4000-8000-000000000005', MOCK_CATEGORIES[4].id, '2026-10', 100),
  budget('b1000000-0000-4000-8000-000000000006', MOCK_CATEGORIES[5].id, '2026-10', 120),
  budget('b1000000-0000-4000-8000-000000000007', MOCK_CATEGORIES[0].id, '2026-09', 400),
  budget('b1000000-0000-4000-8000-000000000008', MOCK_CATEGORIES[1].id, '2026-09', 150),
  budget('b1000000-0000-4000-8000-000000000009', MOCK_CATEGORIES[2].id, '2026-09', 120),
  budget('b1000000-0000-4000-8000-000000000010', MOCK_CATEGORIES[3].id, '2026-09', 160),
];
