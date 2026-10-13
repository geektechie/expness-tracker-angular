import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, toHttpParams } from '../http/api-base-url';
import { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../models/category';

@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/categories`;

  list(includeArchived = false): Observable<Category[]> {
    return this.http.get<Category[]>(this.url, {
      params: toHttpParams({ includeArchived: includeArchived || undefined }),
    });
  }

  get(id: string): Observable<Category> {
    return this.http.get<Category>(`${this.url}/${id}`);
  }

  create(request: CreateCategoryRequest): Observable<Category> {
    return this.http.post<Category>(this.url, request);
  }

  update(id: string, request: UpdateCategoryRequest): Observable<Category> {
    return this.http.put<Category>(`${this.url}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
