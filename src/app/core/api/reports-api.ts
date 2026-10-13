import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, toHttpParams } from '../http/api-base-url';
import { BudgetStatus, SpendingSummary, SpendingTrend, TrendGranularity } from '../models/report';

export interface DateRangeQuery {
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/reports`;

  summary(range: DateRangeQuery = {}): Observable<SpendingSummary> {
    return this.http.get<SpendingSummary>(`${this.url}/summary`, { params: toHttpParams(range) });
  }

  trend(granularity: TrendGranularity, range: DateRangeQuery = {}): Observable<SpendingTrend> {
    return this.http.get<SpendingTrend>(`${this.url}/trend`, {
      params: toHttpParams({ granularity, ...range }),
    });
  }

  budgetStatus(month?: string): Observable<BudgetStatus> {
    return this.http.get<BudgetStatus>(`${this.url}/budget-status`, {
      params: toHttpParams({ month }),
    });
  }
}
