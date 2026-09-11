import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {TranslateService} from "@ngx-translate/core";

import { languages, fallbackLang, storageKeys } from "@/shared/config/const";

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly translateService = inject(TranslateService);

  async ngOnInit() {
    this.setupLang();
  }

  //

  /** Setup language-related stuff. */
  private setupLang() {
    this.translateService.setFallbackLang(fallbackLang);
    const storedLang = localStorage.getItem(storageKeys.language); // get current language from storage
    if (storedLang) { // storage contains language: just use it
      const currLang = this.verifyLang(storedLang) ? storedLang : fallbackLang;
      this.translateService.use(currLang);
    } else { // storage does not have language: resolve language, save to storage and use it
      const browserLang = this.translateService.getBrowserLang() || fallbackLang;
       // if unknown language, fall back to english
      const currLang = this.verifyLang(browserLang) ? browserLang : fallbackLang;
      localStorage.setItem(storageKeys.language, currLang);
      this.translateService.use(currLang);
    }
  }

  /**
   * Check if we know language with given code.
   * @param currLang Current language to check.
   * @returns True if given language is known, otherwise false.
   */
  private verifyLang(currLang: string): boolean {
    const index = languages.findIndex(lang => lang === currLang);
    return index !== -1;
  }
}
