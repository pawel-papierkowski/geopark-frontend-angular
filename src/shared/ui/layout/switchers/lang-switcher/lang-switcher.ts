import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService } from '@/core/i18n/language-service';
import { languages } from '@/shared/config/const';
import type { Lang } from '@/shared/config/types';

/**
 * Language switcher component.
 *
 * Shows all known languages as buttons with flag emojis. Clicking changes language used on website.
 * Choice is remembered.
 */
@Component({
  selector: 'lang-switcher',
  imports: [ TranslatePipe ],
  templateUrl: './lang-switcher.html',
  styleUrl: './lang-switcher.css',
})
export class LangSwitcher {
  private readonly languageService = inject(LanguageService);
  readonly languages = languages;
  readonly currentLang = this.languageService.activeLanguage;

  /**
   * Change language of website to given language.
   * @param language Language.
   */
  selectLang(language: Lang): void {
    // Delegate the selection to the application-wide language coordinator.
    this.languageService.select(language);
  }
}
