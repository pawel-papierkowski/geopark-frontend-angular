import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';

import { HeaderSwitchers } from '@/shared/ui/layout/switchers/header-switchers/header-switchers';

/**
 * Defines header bar on top of webpage. All sections have it, but every section shows it slightly
 * differently.
 */
@Component({
  selector: 'app-header',
  imports: [ TranslatePipe, HeaderSwitchers ],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeader {
  private readonly route = inject(ActivatedRoute);
  private readonly currSection = this.route.snapshot.data['section'];
  cssClass = 'app-header ' + this.currSection;
}
