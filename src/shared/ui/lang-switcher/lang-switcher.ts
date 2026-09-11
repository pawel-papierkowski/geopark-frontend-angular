import { Component, inject } from '@angular/core';
import {TranslateService, TranslatePipe} from '@ngx-translate/core';

import { languages, storageKeys } from "@/shared/config/const";

@Component({
  selector: 'lang-switcher',
  imports: [ TranslatePipe ],
  templateUrl: './lang-switcher.html',
  styleUrl: './lang-switcher.css',
})
export class LangSwitcher {
  private readonly translateService = inject(TranslateService);
  languages = languages;

  /**
   * Change language.
   * @param language Selected language.
   */
  selectLang(language: string) {
    localStorage.setItem(storageKeys.language, language);
    this.translateService.use(language);
  }
}
