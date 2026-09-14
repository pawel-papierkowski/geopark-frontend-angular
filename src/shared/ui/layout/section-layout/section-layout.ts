import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';

import { Section } from '@/shared/config/types';

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
  private readonly route = inject(ActivatedRoute);
  readonly currSection: Section = this.route.snapshot.data['section'];
}
