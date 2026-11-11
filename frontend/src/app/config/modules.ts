
export interface AppModule {
  id: string;
  name: string;
  icon: string;
  route: string;
}

export const APP_MODULES: AppModule[] = [
  {
    id: 'general-registration',
    name: 'People General Registration',
    icon: 'groups',
    route: '/people'
  },
  {
    id: 'patient-visits',
    name: 'Patient Visits',
    icon: 'local_hospital',
    route: '/visits'
  }
];
