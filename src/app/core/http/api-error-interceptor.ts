import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from './api-error';

interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
  errors?: Record<string, string[]>;
  traceId?: string;
}

const MAX_TEXT_DETAIL = 300;

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(catchError((error: unknown) => throwError(() => toApiError(error))));

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(0, 'Something went wrong.', describeUnknown(error), {}, null);
  }

  const problem = asProblemDetails(error.error);

  if (error.status === 0 || isGatewayFailure(error.status, problem)) {
    return new ApiError(
      0,
      'Cannot reach the server.',
      'Check that the Expense Tracker API is running, then try again.',
      {},
      null,
    );
  }

  if (error.status >= 200 && error.status < 300) {
    return new ApiError(
      error.status,
      'The server sent an unexpected response.',
      'Check that /api is routed to the Expense Tracker API.',
      {},
      null,
    );
  }

  return new ApiError(
    error.status,
    problem?.title ?? defaultTitle(error.status),
    displayableDetail(error, problem),
    normaliseFieldErrors(problem?.errors),
    problem?.traceId ?? null,
  );
}

function isGatewayFailure(status: number, problem: ProblemDetails | null): boolean {
  return status === 502 || status === 503 || status === 504 || (status >= 500 && problem === null);
}

function displayableDetail(error: HttpErrorResponse, problem: ProblemDetails | null): string | null {
  if (error.status >= 500) {
    return null;
  }

  if (problem) {
    return problem.detail ?? null;
  }

  if (typeof error.error !== 'string') {
    return null;
  }

  const text = error.error.trim();
  const isMarkup = /html|xml/i.test(error.headers.get('Content-Type') ?? '') || text.startsWith('<');

  return text && !isMarkup && text.length <= MAX_TEXT_DETAIL ? text : null;
}

function asProblemDetails(body: unknown): ProblemDetails | null {
  return body !== null && typeof body === 'object' && !(body instanceof Error)
    ? (body as ProblemDetails)
    : null;
}

function normaliseFieldErrors(errors: Record<string, string[]> | undefined): Record<string, string[]> {
  if (!errors) {
    return {};
  }

  const normalised: Record<string, string[]> = {};

  for (const [rawKey, messages] of Object.entries(errors)) {
    const key = toControlName(rawKey);
    normalised[key] = [...(normalised[key] ?? []), ...messages];
  }

  if (Object.keys(normalised).length > 1) {
    delete normalised['request'];
  }

  return normalised;
}

function toControlName(rawKey: string): string {
  const lastSegment = rawKey.replace(/^\$\./, '').split('.').pop() ?? rawKey;

  return lastSegment.charAt(0).toLowerCase() + lastSegment.slice(1);
}

function defaultTitle(status: number): string {
  if (status >= 500) {
    return 'The server hit an unexpected error.';
  }

  switch (status) {
    case 400:
      return 'The request was not valid.';
    case 404:
      return 'That item no longer exists.';
    case 409:
      return 'That conflicts with existing data.';
    case 429:
      return 'Too many requests — slow down and try again shortly.';
    default:
      return `Request failed (${status}).`;
  }
}

function describeUnknown(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
