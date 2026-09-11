import { Routes } from '@angular/router';

/** Routes for application. */
export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('@/layout/admin/admin.routes')
      .then(m => m.adminRoutes),
  },
  {
    path: 'dev',
    loadChildren: () => import('@/layout/dev/dev.routes')
      .then(m => m.devRoutes),
  },
  { // Important: must be last or we will get false 404.
    path: '',
    loadChildren: () => import('@/layout/public/public.routes')
      .then(m => m.publicRoutes),
  },
];
