import { Routes } from '@angular/router';
import { Landing } from './pages/landing/landing';
import { Patients } from './pages/patients/patients';

export const routes: Routes = [
  {
    path: '',
    component: Landing
  },
  {
    path: 'patients',
    component: Patients
  }
];