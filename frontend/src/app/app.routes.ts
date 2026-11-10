import { Routes } from '@angular/router';
import { Landing } from './pages/landing/landing';
import { Modules } from './pages/modules/modules';

export const routes: Routes = [
  {
    path: '',
    component: Landing
  },
  { 
    path: 'app', 
    component: Modules 
  },
  {
    path: 'people',
    loadComponent: () => import('./pages/people/people').then((m) => m.People)
  }
];