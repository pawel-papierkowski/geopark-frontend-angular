import type { SectionRoute } from '@/shared/config/types';

import { PageNotFound } from '@/layout/not-found/page-not-found';

import { SectionLayout } from '@/shared/ui/layout/section-layout/section-layout';
import { PageLanding } from './pages/landing/page-landing';

/**
 * Routes for public section.
 */
export const publicRoutes: SectionRoute[] = [
  {
    path: '',
    component: SectionLayout,       // Has header + footer + child <router-outlet>.
    data: { section: 'public' },    // Header reads this to know which nav to show.
    children: [
      { path: '', component: PageLanding }, // Default, always loaded eagerly.
      { path: 'about', loadComponent: () => import('./pages/about/page-about').then(m => m.PageAbout) },

      // Must be last.
      { path: '**', component: PageNotFound }
    ],
  }
];
