import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';

import { routes } from './app.routes';
import { apiErrorInterceptor } from './core/http/api-error-interceptor';
import { mockApiInterceptor } from './core/mocks/mock-api.interceptor';
import { PageTitleStrategy } from './core/routing/page-title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),

    provideHttpClient(withFetch(), withInterceptors([mockApiInterceptor, apiErrorInterceptor])),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
  ],
};
