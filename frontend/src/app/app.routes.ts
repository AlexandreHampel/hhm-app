import { Routes } from '@angular/router';
import { Landing } from './pages/landing/landing';
import { Patients } from './pages/patients/patients';
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
    path: 'patients',
    component: Patients
  }
];