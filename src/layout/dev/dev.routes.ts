import type { SectionRoute } from '@/shared/config/types';

import { PageNotFound } from '@/layout/not-found/page-not-found';

import { SectionLayout } from '@/shared/ui/layout/section-layout/section-layout';
import { PageDashboard } from './pages/dashboard/page-dashboard';

/**
 * Routes for developer section.
 * Note: In future we will implement guards for these.
 */
export const devRoutes: SectionRoute[] = [
  {
    path: '',
    component: SectionLayout,    // Has header + footer + child <router-outlet>.
    data: { section: 'dev' },    // Header reads this to know which nav to show.
    children: [
      { path: '', component: PageDashboard }, // Default, always loaded eagerly.
      { path: 'components', loadComponent: () => import('./pages/custom-components/page-custom-components').then(m => m.PageCustomComponents) },

      // Must be last.
      { path: '**', component: PageNotFound }
    ],
  }
];
