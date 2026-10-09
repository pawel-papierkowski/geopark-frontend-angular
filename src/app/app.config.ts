import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling, TitleStrategy } from '@angular/router';

import { provideHttpClient, HttpClient } from '@angular/common/http';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';

import { routes } from './app.routes';
import { CustomHttpLoader } from '@/core/i18n/custom-http-loader';
import { AppTitleStrategy } from '@/core/router/app-title-strategy';

import { fallbackLang } from "@/shared/config/const";

/** General application configuration. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Restore scroll position on back/forward and honor #fragment links (WCAG-friendly UX).
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled',
    })),
    // Localized per-route document titles (WCAG 2.4.2 Page Titled).
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    provideHttpClient(),
    provideTranslateService({
      fallbackLang: fallbackLang,
      loader: provideTranslateLoader(
        () => new CustomHttpLoader(inject(HttpClient), 'i18n/'), // relative path
      ),
    }),
  ]
};
