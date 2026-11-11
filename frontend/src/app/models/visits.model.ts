import { Person } from './people.model';
import { DropdownOption } from '../components/dropdown/dropdown';

export type VisitType = 'OUTPATIENT' | 'EMERGENCY' | 'INPATIENT';
export type VisitStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type VisitMovementType = 'TRIAGE' | 'CARE_STARTED' | 'DEPARTMENT_TRANSFER' | 'DISCHARGE' | 'CANCELLATION' | 'OTHER';

export interface VisitOption<T extends string> extends DropdownOption {
  value: T;
}

export const VISIT_TYPES: VisitOption<VisitType>[] = [
  { value: 'OUTPATIENT', label: 'Outpatient', key: 'outpatient' },
  { value: 'EMERGENCY', label: 'Emergency', key: 'emergency' },
  { value: 'INPATIENT', label: 'Inpatient', key: 'inpatient' }
];

export const VISIT_STATUSES: VisitOption<VisitStatus>[] = [
  { value: 'OPEN', label: 'Open', key: 'open' },
  { value: 'IN_PROGRESS', label: 'In Progress', key: 'in-progress' },
  { value: 'COMPLETED', label: 'Completed', key: 'completed' },
  { value: 'CANCELLED', label: 'Cancelled', key: 'cancelled' }
];

export const VISIT_MOVEMENT_TYPES: VisitOption<VisitMovementType>[] = [
  { value: 'TRIAGE', label: 'Triage', key: 'triage' },
  { value: 'CARE_STARTED', label: 'Care Started', key: 'care-started' },
  { value: 'DEPARTMENT_TRANSFER', label: 'Department Transfer', key: 'department-transfer' },
  { value: 'DISCHARGE', label: 'Discharge', key: 'discharge' },
  { value: 'CANCELLATION', label: 'Cancellation', key: 'cancellation' },
  { value: 'OTHER', label: 'Other', key: 'other' }
];

// A patient may have at most one visit in one of these statuses at any time.
export const ACTIVE_VISIT_STATUSES: VisitStatus[] = ['OPEN', 'IN_PROGRESS'];

// Field limits, matching the API validation.
export const CHIEF_COMPLAINT_MAX_LENGTH = 500;
export const NOTES_MAX_LENGTH = 2000;
export const DEPARTMENT_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 1000;

// Movements that close the visit; they require explicit confirmation.
export const CLOSING_MOVEMENT_TYPES: VisitMovementType[] = ['DISCHARGE', 'CANCELLATION'];

export type PatientSummary = Pick<Person, '_id' | 'name' | 'cpf'>;
export type ProfessionalSummary = Pick<Person, '_id' | 'name' | 'roles'>;

export interface Visit {
  _id: string;
  patientId: string;
  patient: PatientSummary | null;
  type: VisitType;
  status: VisitStatus;
  admissionDate: string;
  attendingProfessionalId: string | null;
  attendingProfessional: ProfessionalSummary | null;
  chiefComplaint: string;
  notes?: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisitPayload {
  patientId: string;
  type: VisitType;
  admissionDate: string;
  attendingProfessionalId: string | null;
  chiefComplaint: string;
  notes: string;
}

export type VisitUpdatePayload = Omit<VisitPayload, 'patientId' | 'admissionDate'>;

export interface VisitFilters {
  patientId?: string;
  professionalId?: string;
  chiefComplaint?: string;
  type?: VisitType;
  status?: VisitStatus;
  admissionFrom?: string;
  admissionTo?: string;
  page: number;
  limit: number;
}

export interface VisitPage {
  items: Visit[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActivePatient {
  patientId: string;
  visitId: string;
  status: VisitStatus;
}

export interface VisitMovement {
  _id: string;
  visitId: string;
  type: VisitMovementType;
  occurredAt: string;
  departmentFrom?: string;
  departmentTo?: string;
  responsibleProfessionalId: string | null;
  responsibleProfessional: ProfessionalSummary | null;
  description?: string;
  createdAt: string;
}

export interface VisitMovementPayload {
  type: VisitMovementType;
  occurredAt?: string;
  departmentFrom?: string;
  departmentTo?: string;
  responsibleProfessionalId: string | null;
  description?: string;
}

export function optionFor<T extends string>(options: VisitOption<T>[], value: T): VisitOption<T> {
  return options.find((option) => option.value === value) ?? { value, label: value, key: value.toLowerCase() };
}

export function isActiveVisit(visit: Pick<Visit, 'status'>): boolean {
  return ACTIVE_VISIT_STATUSES.includes(visit.status);
}

// Eligible attending/responsible professionals: any role other than PATIENT.
export function isProfessional(person: Pick<Person, 'roles'>): boolean {
  return person.roles.some((role) => role !== 'PATIENT');
}
