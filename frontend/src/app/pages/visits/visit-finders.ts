
import { PERSON_ROLES, Person } from '../../models/people.model';
import { FilterField } from '../../components/filter/filter';
import { GridColumn } from '../../components/grid/grid';
import { CpfPipe } from '../../pipes/cpf';

// Shared configuration of the patient and professional finders.

const cpfPipe = new CpfPipe();

export const personId = (person: Person): string => person._id;
export const personName = (person: Person): string => person.name;

export const PERSON_SEARCH_FIELDS: FilterField<Person>[] = [
  { id: 'name', label: 'Name', match: 'contains', value: (person) => person.name },
  { id: 'cpf', label: 'CPF', match: 'digits', value: (person) => person.cpf, inputMode: 'numeric', placeholder: '000.000.000-00' }
];

const NAME_COLUMN: GridColumn<Person> = { id: 'name', header: 'Name', value: (person) => person.name, nowrap: true };
const CPF_COLUMN: GridColumn<Person> = { id: 'cpf', header: 'CPF', value: (person) => cpfPipe.transform(person.cpf), nowrap: true };

export const PROFESSIONAL_COLUMNS: GridColumn<Person>[] = [
  NAME_COLUMN,
  CPF_COLUMN,
  {
    id: 'roles',
    header: 'Roles',
    value: (person) => [
      ...person.roles
        .filter((role) => role !== 'OTHER')
        .map((role) => PERSON_ROLES.find((option) => option.value === role)?.label ?? role),
      ...(person.custom_roles ?? [])
    ].join(', ')
  }
];

export const PATIENT_COLUMNS: GridColumn<Person>[] = [NAME_COLUMN, CPF_COLUMN];
