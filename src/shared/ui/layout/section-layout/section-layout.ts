import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppHeader } from '@/layout/header/app-header';
import { AppFooter } from '@/layout/footer/app-footer';

/**
 * Layout wrapper.
 */
@Component({
  imports: [RouterOutlet, AppHeader, AppFooter],
  selector: 'section-layout',
  styleUrl: './section-layout.css',
  templateUrl: './section-layout.html',
})
export class SectionLayout {
}
