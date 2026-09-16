import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { NavLink } from '@/shared/ui/layout/nav-link/nav-link';

/**
 * Navigation for dev section.
 */
@Component({
  selector: 'nav-dev',
  imports: [ TranslatePipe, NavLink ],
  styleUrl: './nav-dev.css',
  templateUrl: './nav-dev.html',
})
export class NavDev {
}
