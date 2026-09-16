import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { NavLink } from '@/shared/ui/layout/nav-link/nav-link';

/**
 * Navigation for admin section.
 */
@Component({
  selector: 'nav-admin',
  imports: [ TranslatePipe, NavLink ],
  styleUrl: './nav-admin.css',
  templateUrl: './nav-admin.html',
})
export class NavAdmin {
}
