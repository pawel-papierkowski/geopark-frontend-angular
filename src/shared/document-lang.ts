import { DOCUMENT, inject, Service } from '@angular/core';

import type { Lang } from '@/shared/config/types';

@Service()
export class DocumentLang {
  private readonly document = inject(DOCUMENT);

  setDocumentLang(lang: Lang): void {
    this.document.documentElement.lang = lang;
  }
}
