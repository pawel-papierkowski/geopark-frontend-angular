import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { sections } from '@/shared/config/const';
import { Section } from '@/shared/config/types';

/**
 * Provides accessible links that allow navigation between sections of this website.
 * Note: in real application this component would not exist - any user/developer/operator would have
 * to use appropriate links.
 * But for portfolio project, way to access other sections from within website is needed.
 *
 * Inputs:
 * - currSection - Current section.
 */
@Component({
  selector: 'section-switcher',
  imports: [ TranslatePipe, RouterLink ],
  templateUrl: './section-switcher.html',
  styleUrl: './section-switcher.css',
})
export class SectionSwitcher {
  readonly currSection = input.required<Section>();
  readonly otherSections = computed(() => sections.filter(s => s !== this.currSection()));

  /** Available sections and their target URLs. */
  readonly sectionRoutes: Record<Section, string[]> = {
    public: ['/'],
    admin: ['/admin'],
    dev: ['/dev'],
  };
}
