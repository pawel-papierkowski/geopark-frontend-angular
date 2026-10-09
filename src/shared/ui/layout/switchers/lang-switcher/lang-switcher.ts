import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService } from '@/core/i18n/language-service';
import { languages } from '@/shared/config/const';
import type { Lang } from '@/shared/config/types';

/**
 * Language switcher component.
 *
 * Shows all known languages as buttons with flag emojis. Clicking changes the language used on the website.
 * The choice is remembered.
 *
 * User feedback after click and failure to set new language.
 */
@Component({
  selector: 'lang-switcher',
  imports: [ TranslatePipe ],
  templateUrl: './lang-switcher.html',
  styleUrl: './lang-switcher.css',
})
export class LangSwitcher {
  private readonly languageService = inject(LanguageService);
  public readonly languages = languages;
  /** Language whose translations are currently confirmed active. */
  public readonly currentLang = this.languageService.activeLanguage;
  /** Language whose translations are currently loading, or null when nothing is in flight. */
  public readonly pendingLang = this.languageService.pendingLanguage;
  /** Language whose latest request failed, or null when no attempt failed. */
  public readonly failedLang = this.languageService.failedLanguage;

  /**
   * Change language of website to given language.
   * @param language Language.
   */
  public selectLang(language: Lang): void {
    // Delegate the selection to the application-wide language coordinator.
    this.languageService.select(language);
  }
}
