import { Component, inject, signal } from '@angular/core';
import {TranslateService, TranslatePipe} from '@ngx-translate/core';

import { languages, storageKeys } from "@/shared/config/const";
import { Lang } from '@/shared/config/types';

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
    this.currentLang.set(language);
  }
}
