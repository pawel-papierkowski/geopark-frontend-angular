import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe} from '@ngx-translate/core';

import { Section, sections } from '@/shared/config/types';

/**
 * Provides clickable emojis that allow navigation between sections of this website.
 * Note: in real application this component would not exist - any user/developer/operator would have to use appropriate links.
 * But for portfolio project, way to access other sections from within website is needed.
 */
@Component({
  selector: 'section-switcher',
  imports: [ TranslatePipe ],
  templateUrl: './section-switcher.html',
  styleUrl: './section-switcher.css',
})
export class SectionSwitcher {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currSection = this.route.snapshot.data['section'];
  otherSections = computed(() => sections.filter(s => s !== this.currSection));

  /**
   * Navigate to given section.
   * @param section Destination.
   */
  goToSection(section: Section) {
    switch (section) {
      case 'public': this.router.navigate(['/']); break;
      case 'admin': this.router.navigate(['/admin']); break;
      case 'dev': this.router.navigate(['/dev']);
    }
  }
}
