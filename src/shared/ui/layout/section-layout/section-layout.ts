import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';

import { Section } from '@/shared/config/types';

import { AppHeader } from '@/layout/header/app-header';
import { AppFooter } from '@/layout/footer/app-footer';

/**
 * Defines layout for given section. All sections use SectionLayout, but content can differ depending on what section is currently visited.
 */
@Component({
  imports: [RouterOutlet, AppHeader, AppFooter],
  selector: 'section-layout',
  styleUrl: './section-layout.css',
  templateUrl: './section-layout.html',
})
export class SectionLayout {
  private readonly route = inject(ActivatedRoute);
  // Note it is not reactive. It is fine, as each section has its own SectionLayout instance.
  readonly currSection: Section = this.route.snapshot.data['section'];
}
