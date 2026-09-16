import { Component, inject, type OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {TranslateService} from "@ngx-translate/core";

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

    localStorage.setItem(storageKeys.language, currLang);
    this.translateService.use(currLang);
    this.documentLang.setDocumentLang(currLang);
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
