import { Component, inject, signal } from '@angular/core';
import {TranslateService, TranslatePipe} from '@ngx-translate/core';

import { languages, storageKeys } from "@/shared/config/const";
import { Lang } from '@/shared/config/types';
import { DocumentLang } from '@/shared/document-lang';

/**
 * Provides flags that can be clicked, changing language used on page.
 */
@Component({
  selector: 'lang-switcher',
  imports: [ TranslatePipe ],
  templateUrl: './lang-switcher.html',
  styleUrl: './lang-switcher.css',
})
export class LangSwitcher {
  private readonly translateService = inject(TranslateService);
  private readonly documentLang = inject(DocumentLang);
  languages = languages;

  /** Currently active language. */
  readonly currentLang = signal<Lang>(this.translateService.currentLang() as Lang);

  /**
   * Change language.
   * @param language Selected language.
   */
  selectLang(language: Lang) {
    localStorage.setItem(storageKeys.language, language);
    this.translateService.use(language);
    this.documentLang.setDocumentLang(language);
    this.currentLang.set(language);
  }
}
