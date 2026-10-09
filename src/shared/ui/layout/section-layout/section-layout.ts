import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { sections } from '@/shared/config/const';
import { Section } from '@/shared/config/types';

import { AppHeader } from '@/layout/header/app-header';
import { AppFooter } from '@/layout/footer/app-footer';

/**
 * Checks whether given value is one of the known sections.
 * @param value Value to check.
 * @returns True when value is a known section.
 */
function isSection(value: unknown): value is Section {
  return typeof value === 'string' && (sections as readonly string[]).includes(value);
}

/**
 * Defines layout for a given section. All sections use SectionLayout, but content can differ depending on what section is currently visited.
 */
@Component({
  imports: [TranslatePipe, RouterOutlet, AppHeader, AppFooter],
  selector: 'section-layout',
  styleUrl: './section-layout.css',
  templateUrl: './section-layout.html',
})
export class SectionLayout {
  private readonly route = inject(ActivatedRoute);
  // Note it is not reactive. It is fine, as each section has its own SectionLayout instance.
  public readonly currSection: Section = this.resolveSection();

  /**
   * Reads the section assigned to the current route and validates it against known sections.
   * Fails fast so a misconfigured route never silently renders the wrong header/nav.
   * @returns The validated section this layout represents.
   * @throws When route data `section` is missing or is not a known section.
   */
  private resolveSection(): Section {
    const section: unknown = this.route.snapshot.data['section'];
    if (!isSection(section)) {
      throw new Error(
        `SectionLayout: route data 'section' is missing or invalid (received: ${String(section)}). Expected one of: ${sections.join(', ')}.`
      );
    }
    return section;
  }
}
