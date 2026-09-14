import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideHttpClient, HttpClient } from '@angular/common/http';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';

import { routes } from './app.routes';
import { CustomHttpLoader } from '@/core/i18n/custom-http-loader';

import { fallbackLang } from "@/shared/config/const";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideTranslateService({
      fallbackLang: fallbackLang,
      loader: provideTranslateLoader(
        () => new CustomHttpLoader(inject(HttpClient), 'i18n/'), // relative path
      ),
    }),
  ]
};
