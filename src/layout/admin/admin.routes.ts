import { Routes } from '@angular/router';

import { PageNotFound } from '@/layout/not-found/page-not-found';

import { AdminLayout } from './layout/admin-layout';
import { PageOverview } from './pages/overview/page-overview';

/** Routes for administration section. */
export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminLayout,        // Has header + footer + child <router-outlet>.
    data: { section: 'admin' },    // Header reads this to know which nav to show.
    children: [
      { path: '', component: PageOverview },
      { path: '**', component: PageNotFound }
    ],
  }
];
