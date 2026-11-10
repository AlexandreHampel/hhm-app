export type PersonRole = 'DOCTOR' | 'NURSE' | 'NURSING_TECHNICIAN' | 'PATIENT' | 'OTHER';

export interface PersonRoleOption {
  value: PersonRole;
  label: string;
  key: string;
}

export const PERSON_ROLES: PersonRoleOption[] = [
  { value: 'DOCTOR', label: 'Doctor', key: 'doctor' },
  { value: 'NURSE', label: 'Nurse', key: 'nurse' },
  { value: 'NURSING_TECHNICIAN', label: 'Nursing Technician', key: 'nursing-technician' },
  { value: 'PATIENT', label: 'Patient', key: 'patient' },
  { value: 'OTHER', label: 'Other', key: 'other' }
];

export interface Person {
  _id: string;
  name: string;
  cpf: string;
  birthDate: string;
  email?: string;
  phone?: string;
  roles: PersonRole[];
  custom_roles: string[];
}

export type PersonPayload = Pick<
  Person,
  'name' | 'cpf' | 'birthDate' | 'email' | 'phone' | 'roles' | 'custom_roles'
>;
