import { Routes } from '@angular/router';

import { PublicLayout } from './layout/public-layout';
import { PageLanding } from './pages/landing/page-landing';

/** Routes for public section. */
export const publicRoutes: Routes = [
  {
    path: '',
    component: PublicLayout,        // Has header + footer + child <router-outlet>.
    data: { section: 'public' },    // Header reads this to know which nav to show.
    children: [
      { path: '', component: PageLanding },
      { path: 'about', loadComponent: () => import('./pages/about/page-about').then(m => m.PageAbout) },
      // ... more public pages
    ],
  },
];
