import { Component, computed, input } from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';

import { Section } from '@/shared/config/types';

import { HeaderSwitchers } from '@/shared/ui/layout/switchers/header-switchers/header-switchers';

/**
 * Defines header bar on top of webpage. All sections have it, but can show it slightly differently
 * via section-specific CSS classes.
 *
 * Inputs:
 * - currSection - Current section.
 */
@Component({
  selector: 'app-header',
  imports: [ TranslatePipe, HeaderSwitchers ],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeader {
  readonly currSection = input.required<Section>();
  readonly cssClass = computed(() => 'app-header ' + this.currSection());
}
