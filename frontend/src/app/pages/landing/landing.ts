import { Component } from '@angular/core';

@Component({
  selector: 'app-landing',
  standalone: false,
  templateUrl: './landing.html',
  styleUrl: './landing.scss'
})

export class Landing {

  readonly features = [
    {
      title: 'Patient Management',
      description: 'Manage patient profiles, medical histories, and essential information in one centralized location.',
      icon: 'people'
    },
    {
      title: 'Healthcare Professionals',
      description: 'Organize medical staff, specialties, and professional schedules with ease.',
      icon: 'medical_services'
    },
    {
      title: 'Appointments & Care',
      description: 'Coordinate appointments, patient visits, and clinical workflows efficiently.',
      icon: 'event'
    },
    {
      title: 'Admissions',
      description: 'Track hospital admissions, bed availability, and patient discharge processes.',
      icon: 'hotel'
    },
    {
      title: 'Financial Management',
      description: 'Simplify billing, insurance management, and financial operations.',
      icon: 'payments'
    },
    {
      title: 'Reports & Analytics',
      description: 'Turn operational data into meaningful insights with intuitive dashboards and reports.',
      icon: 'bar_chart'
    }
  ];

  readonly benefits = [
    {
      title: 'Operational Efficiency',
      description: 'Optimize workflows, reduce administrative tasks, and increase productivity.',
      icon: 'settings'
    },
    {
      title: 'Security First',
      description: 'Designed with data protection and secure access in mind.',
      icon: 'verified_user'
    },
    {
      title: 'Patient-Centered',
      description: 'Spend less time managing systems and more time delivering quality care.',
      icon: 'favorite_border'
    },
    {
      title: 'Fast & Intuitive',
      description: 'Access essential information through a clean, responsive interface.',
      icon: 'bolt'
    }
  ];
}
