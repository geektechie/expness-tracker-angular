export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string | null,
    readonly fieldErrors: Readonly<Record<string, readonly string[]>>,
    readonly traceId: string | null,
  ) {
    super(detail ?? title);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }

  get displayMessage(): string {
    if (this.isNotFound) {
      return 'That item no longer exists.';
    }

    if (this.detail) {
      return this.detail;
    }

    const firstFieldError = Object.values(this.fieldErrors)[0]?.[0];

    return firstFieldError ?? this.title;
  }

  fieldError(field: string): string | null {
    return this.fieldErrors[field]?.[0] ?? null;
  }
}
