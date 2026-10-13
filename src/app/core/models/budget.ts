export interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColorHex: string;
  month: string;
  limit: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBudgetRequest {
  categoryId: string;
  month: string;
  limit: number;
}
