import { Component, input } from '@angular/core';

import { Section } from '@/shared/config/types';

import { LangSwitcher } from '@/shared/ui/layout/switchers/lang-switcher/lang-switcher';
import { SectionSwitcher } from '@/shared/ui/layout/switchers/section-switcher/section-switcher';

/**
 * Contains all switchers at correct place in header.
 *
 * Inputs:
 * - currSection - Current section.
 */
@Component({
  selector: 'header-switchers',
  imports: [ LangSwitcher, SectionSwitcher ],
  templateUrl: './header-switchers.html',
  styleUrl: './header-switchers.css',
})
export class HeaderSwitchers {
  readonly currSection = input.required<Section>();
}
