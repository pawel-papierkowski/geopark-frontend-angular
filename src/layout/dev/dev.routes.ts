import { Routes } from '@angular/router';

import { DevLayout } from './layout/dev-layout';
import { PageDashboard } from './pages/dashboard/page-dashboard';

/** Routes for developer section. */
export const devRoutes: Routes = [
  {
    path: '',
    component: DevLayout,        // Has header + footer + child <router-outlet>.
    data: { section: 'dev' },    // Header reads this to know which nav to show.
    children: [
      { path: '', component: PageDashboard },
    ],
  },
];
