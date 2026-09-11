import { Routes } from '@angular/router';

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
    ],
  },
];
