import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { NavLink } from '@/shared/ui/layout/nav-link/nav-link';

/**
 * Navigation for public section.
 */
@Component({
  selector: 'nav-public',
  imports: [ TranslatePipe, NavLink ],
  templateUrl: './nav-public.html',
})
export class NavPublic {
}
