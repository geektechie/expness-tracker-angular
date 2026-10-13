import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, toHttpParams } from '../http/api-base-url';
import {
  CreateExpenseRequest,
  Expense,
  ExpenseQuery,
  UpdateExpenseRequest,
} from '../models/expense';
import { PagedResult } from '../models/paged-result';

@Injectable({ providedIn: 'root' })
export class ExpensesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/expenses`;

  list(query: ExpenseQuery = {}): Observable<PagedResult<Expense>> {
    return this.http.get<PagedResult<Expense>>(this.url, { params: toHttpParams(query) });
  }

  get(id: string): Observable<Expense> {
    return this.http.get<Expense>(`${this.url}/${id}`);
  }

  create(request: CreateExpenseRequest): Observable<Expense> {
    return this.http.post<Expense>(this.url, request);
  }

  update(id: string, request: UpdateExpenseRequest): Observable<Expense> {
    return this.http.put<Expense>(`${this.url}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
