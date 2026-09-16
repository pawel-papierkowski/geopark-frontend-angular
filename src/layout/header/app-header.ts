import { Component, computed, input } from '@angular/core';

import { Section } from '@/shared/config/types';

import { HeaderSwitchers } from '@/shared/ui/layout/switchers/header-switchers/header-switchers';
import { NavPublic } from '@/layout/public/nav/nav-public';
import { NavDev } from '@/layout/dev/nav/nav-dev';
import { NavAdmin } from '@/layout/admin/nav/nav-admin';

/**
 * Defines header bar on top of webpage. Header recognizes current section. Differences:
 * - Header has additional section-specific CSS class.
 * - Used navigation component is different depending on section.
 *
 * Inputs:
 * - currSection - Current section.
 */
@Component({
  selector: 'app-header',
  imports: [ HeaderSwitchers, NavPublic, NavDev, NavAdmin ],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeader {
  readonly currSection = input.required<Section>();
  readonly cssClass = computed(() => 'app-header ' + this.currSection());
}
