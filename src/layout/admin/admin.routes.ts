import type { SectionRoute } from '@/shared/config/types';

import { PageNotFound } from '@/layout/not-found/page-not-found';

import { SectionLayout } from '@/shared/ui/layout/section-layout/section-layout';
import { PageOverview } from './pages/overview/page-overview';

/** Routes for administration section. */
export const adminRoutes: SectionRoute[] = [
  {
    path: '',
    component: SectionLayout,      // Has header + footer + child <router-outlet>.
    data: { section: 'admin' },    // Header reads this to know which nav to show.
    children: [
      { path: '', component: PageOverview }, // Default.

      // Must be last.
      { path: '**', component: PageNotFound }
    ],
  }
];
