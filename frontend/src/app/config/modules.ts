
export interface AppModule {
  id: string;
  name: string;
  description: string;
  route: string;
}

export const APP_MODULES: AppModule[] = [
  {
    id: 'general-registration',
    name: 'General Registration',
    description: 'Manage people, patients and healthcare professionals.',
    route: '/people'
  }
];
