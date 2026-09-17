import { Component, inject, type OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LanguageService } from '@/core/i18n/language-service';

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
  private readonly languageService = inject(LanguageService);

  /** Initializes application-wide language handling. */
  ngOnInit(): void {
    this.languageService.initialize();
  }
}
