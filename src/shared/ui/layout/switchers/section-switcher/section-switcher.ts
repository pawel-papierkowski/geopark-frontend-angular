import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe} from '@ngx-translate/core';

import { sections } from '@/shared/config/const';
import { Section } from '@/shared/config/types';

/**
 * Provides clickable emojis that allow navigation between sections of this website.
 * Note: in real application this component would not exist - any user/developer/operator would have
 * to use appropriate links.
 * But for portfolio project, way to access other sections from within website is needed.
 *
 * Inputs:
 * - currSection - Current section.
 */
@Component({
  selector: 'section-switcher',
  imports: [ TranslatePipe ],
  templateUrl: './section-switcher.html',
  styleUrl: './section-switcher.css',
})
export class SectionSwitcher {
  private readonly router = inject(Router);
  readonly currSection = input.required<Section>();
  readonly otherSections = computed(() => sections.filter(s => s !== this.currSection()));

  /** Available sections and their target URL. */
  private readonly sectionRoutes: Record<Section, string[]> = {
    public: ['/'],
    admin: ['/admin'],
    dev: ['/dev'],
  };

  /**
   * Navigate to given section.
   * @param section Destination.
   */
  goToSection(section: Section) {
    this.router.navigate(this.sectionRoutes[section]);
  }
}
