import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'expenses',
    title: 'Expenses',
    loadComponent: () =>
      import('./features/expenses/expense-list/expense-list').then((m) => m.ExpenseList),
  },
  {
    path: 'categories',
    title: 'Categories',
    loadComponent: () =>
      import('./features/categories/category-list/category-list').then((m) => m.CategoryList),
  },
  {
    path: 'budgets',
    title: 'Budgets',
    loadComponent: () =>
      import('./features/budgets/budget-planner/budget-planner').then((m) => m.BudgetPlanner),
  },
  {
    path: 'reports',
    title: 'Reports',
    loadComponent: () => import('./features/reports/reports').then((m) => m.Reports),
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
