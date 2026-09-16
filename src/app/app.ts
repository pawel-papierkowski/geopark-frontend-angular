import { Component, inject, type OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { languages, fallbackLang, storageKeys } from "@/shared/config/const";
import { Lang } from '@/shared/config/types';
import { DocumentLang } from '@/shared/document-lang';

/**
 * Main application component.
 */
@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly translateService = inject(TranslateService);
  private readonly documentLang = inject(DocumentLang);

  /** Guard against stale language activation completing after a newer attempt. */
  private activationSeq = 0;
  /** Active language activation subscription, kept to cancel superseded attempts. */
  private activationSub: Subscription | null = null;

  /** Initialization. */
  ngOnInit() {
    this.setupLang();
  }

  /** Setup language-related stuff. */
  private setupLang() {
    this.translateService.setFallbackLang(fallbackLang);
    const storedLang = localStorage.getItem(storageKeys.language);
    const preferredLang = storedLang || this.translateService.getBrowserLang() || fallbackLang;
    const currLang = this.verifyLang(preferredLang) ? preferredLang : fallbackLang;

    this.activateLanguage(currLang, true);
  }

  /**
   * Activate language and persist/document it only on success. On failure of initial language,
   * attempt fallback language once. Supersedes any in-flight activation.
   * @param lang Language code to activate.
   * @param allowFallback True when fallback language may be attempted on failure.
   */
  private activateLanguage(lang: Lang, allowFallback: boolean) {
    this.activationSub?.unsubscribe();
    const seq = ++this.activationSeq;

    this.activationSub = this.translateService.use(lang).subscribe({
      next: () => {
        if (seq !== this.activationSeq) return;
        localStorage.setItem(storageKeys.language, lang);
        this.documentLang.setDocumentLang(lang);
      },
      error: (err: unknown) => {
        if (seq !== this.activationSeq) return;
        console.error(`Failed to load translations for language '${lang}'.`, err);
        if (allowFallback && lang !== fallbackLang) {
          this.activateLanguage(fallbackLang, false);
        }
      },
    });
  }

  /**
   * Check if we know language with given code.
   * @param currLang Current language to check.
   * @returns True if given language is known, otherwise false.
   */
  private verifyLang(currLang: string): currLang is Lang {
    return languages.includes(currLang as Lang);
  }
}
