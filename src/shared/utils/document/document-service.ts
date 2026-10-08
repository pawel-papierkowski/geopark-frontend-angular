import { DOCUMENT, inject, Service } from '@angular/core';

import type { Lang } from '@/shared/config/types';

/**
 * Service for handling document.
 */
@Service()
export class DocumentService {
  private readonly document = inject(DOCUMENT);

  /**
   * Set the language of the document - the `lang` attribute of the `<html>` element.
   * @param lang Language to set.
   */
  setDocumentLang(lang: Lang): void {
    this.document.documentElement.lang = lang;
  }
}
