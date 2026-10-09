import { Component, inject, type OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LanguageService } from '@/core/i18n/language-service';
import { RouteFocusService } from '@/core/router/route-focus-service';

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
  private readonly routeFocusService = inject(RouteFocusService);

  /** Initializes application-wide language handling and route focus management. */
  public ngOnInit(): void {
    this.languageService.initialize();
    this.routeFocusService.initialize();
  }
}
