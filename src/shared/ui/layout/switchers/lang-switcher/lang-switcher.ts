import { Component, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

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

  /** Guard against stale switch completing after a newer selection. */
  private switchSeq = 0;
  /** Active switch subscription, kept to cancel superseded attempts. */
  private switchSub: Subscription | null = null;

  /**
   * Change language. State is updated only when translation load succeeds.
   * On failure previous language is kept.
   * @param language Selected language.
   */
  selectLang(language: Lang) {
    this.switchSub?.unsubscribe();
    const seq = ++this.switchSeq;

    this.switchSub = this.translateService.use(language).subscribe({
      next: () => {
        if (seq !== this.switchSeq) return;
        localStorage.setItem(storageKeys.language, language);
        this.documentLang.setDocumentLang(language);
        this.currentLang.set(language);
      },
      error: (err: unknown) => {
        if (seq !== this.switchSeq) return;
        console.error(`Failed to switch language to '${language}'.`, err);
      },
    });
  }
}
