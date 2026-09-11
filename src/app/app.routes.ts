import { Routes } from '@angular/router';

/** Routes for application. */
export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('@/layout/public/public.routes')
      .then(m => m.publicRoutes),
  },
  {
    path: 'dev',
    loadChildren: () => import('@/layout/dev/dev.routes')
      .then(m => m.devRoutes),
  },
  {
    path: 'admin',
    loadChildren: () => import('@/layout/admin/admin.routes')
      .then(m => m.adminRoutes),
  },

];
