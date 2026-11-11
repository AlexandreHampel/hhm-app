import { Routes } from '@angular/router';
import { Landing } from './pages/landing/landing';
import { Modules } from './pages/modules/modules';
import { internalNavigationGuard } from './guards/internal-navigation.guard';

export const routes: Routes = [
  {
    path: '',
    component: Landing
  },
  {
    path: 'app',
    canActivate: [internalNavigationGuard],
    component: Modules
  },
  {
    path: 'people',
    canActivate: [internalNavigationGuard],
    loadComponent: () => import('./pages/people/people').then((m) => m.People)
  },
  {
    path: 'visits',
    canActivate: [internalNavigationGuard],
    loadComponent: () => import('./pages/visits/visits').then((m) => m.Visits)
  },
  {
    path: 'visits/new',
    canActivate: [internalNavigationGuard],
    loadComponent: () => import('./pages/visit-new/visit-new').then((m) => m.VisitNew)
  },
  {
    path: 'visits/id/:id',
    canActivate: [internalNavigationGuard],
    loadComponent: () => import('./pages/visit-details/visit-details').then((m) => m.VisitDetails)
  }
];