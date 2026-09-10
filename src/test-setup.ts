import '@angular/compiler';

import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import { provideTranslateService } from '@ngx-translate/core';

setupTestBed({
  providers: [
    provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
  ],
});
