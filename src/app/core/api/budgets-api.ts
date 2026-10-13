import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api-base-url';
import { Budget, UpsertBudgetRequest } from '../models/budget';

@Injectable({ providedIn: 'root' })
export class BudgetsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/budgets`;

  listForMonth(month: string): Observable<Budget[]> {
    return this.http.get<Budget[]>(`${this.url}/${encodeURIComponent(month)}`);
  }

  upsert(request: UpsertBudgetRequest): Observable<Budget> {
    return this.http.put<Budget>(this.url, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
