export interface Category {
  id: string;
  name: string;
  colorHex: string;
  isArchived: boolean;
  expenseCount: number;
  createdAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  colorHex: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  colorHex?: string;
  isArchived?: boolean;
}

export const CATEGORY_NAME_MAX_LENGTH = 60;
