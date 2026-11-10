
import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { PERSON_ROLES, Person, PersonPayload, PersonRole, PersonRoleOption } from '../../models/people.model';
import { PeopleService } from '../../services/people.service';
import { LoaderService } from '../../services/loader.service';
import { CrudToolbar } from '../../components/crud-toolbar/crud-toolbar';
import { Filter, FilterField, FilterValues, filterRows } from '../../components/filter/filter';
import { FormDialog } from '../../components/form-dialog/form-dialog';
import { Grid, GridColumn } from '../../components/grid/grid';
import { GridCell } from '../../components/grid/grid-cell';
import { Loader } from '../../components/loader/loader';
import { MessageDialog } from '../../components/message-dialog/message-dialog';
import { CpfPipe } from '../../pipes/cpf';
import { PhonePipe } from '../../pipes/phone';

type CustomRoleForm = FormGroup<{
  clientId: FormControl<number>;
  name: FormControl<string>;
}>;

const CPF_PATTERN = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s()-]+$/;

function requiredTrimmedValidator(control: AbstractControl<string>): ValidationErrors | null {
  return control.value?.trim() ? null : { required: true };
}

function cpfValidator(control: AbstractControl<string>): ValidationErrors | null {
  const cpf = control.value?.trim() ?? '';

  if (!cpf) {
    return null;
  }

  if (!CPF_PATTERN.test(cpf)) {
    return { cpfFormat: true };
  }

  const digits = cpf.replace(/\D/g, '');

  if (/^(\d)\1{10}$/.test(digits)) {
    return { cpfInvalid: true };
  }

  const numbers = digits.split('').map(Number);

  for (const length of [9, 10]) {
    let sum = 0;

    for (let index = 0; index < length; index++) {
      sum += numbers[index] * (length + 1 - index);
    }

    if ((sum * 10) % 11 % 10 !== numbers[length]) {
      return { cpfInvalid: true };
    }
  }

  return null;
}

function todayIsoDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function pastDateValidator(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && control.value > todayIsoDate() ? { futureDate: true } : null;
}

function emailValidator(control: AbstractControl<string>): ValidationErrors | null {
  const email = control.value?.trim() ?? '';
  return !email || EMAIL_PATTERN.test(email) ? null : { email: true };
}

function phoneValidator(control: AbstractControl<string>): ValidationErrors | null {
  const phone = control.value?.trim() ?? '';
  const digitCount = phone.replace(/\D/g, '').length;

  return !phone || (PHONE_PATTERN.test(phone) && digitCount >= 8 && digitCount <= 15)
    ? null
    : { phone: true };
}

function atLeastOneRoleValidator(control: AbstractControl): ValidationErrors | null {
  return Object.values(control.value as Record<string, boolean>).some(Boolean)
    ? null
    : { rolesRequired: true };
}

function uniqueCustomRolesValidator(control: AbstractControl): ValidationErrors | null {
  const names = (control.value as { name: string }[])
    .map((customRole) => customRole.name.trim().toLocaleLowerCase())
    .filter(Boolean);

  return new Set(names).size === names.length ? null : { duplicateCustomRoles: true };
}

function customRolesRequiredValidator(control: AbstractControl): ValidationErrors | null {
  const { roles, custom_roles } = control.value as {
    roles?: Record<string, boolean>;
    custom_roles?: unknown[];
  };

  return roles?.['OTHER'] && !custom_roles?.length ? { customRolesRequired: true } : null;
}


@Component({
  selector: 'app-people',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, CrudToolbar, Filter, FormDialog, Grid, GridCell, Loader, MessageDialog, CpfPipe, PhonePipe],
  templateUrl: './people.html',
  styleUrl: './people.scss'
})

export class People implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly peopleService = inject(PeopleService);
  private readonly loaderService = inject(LoaderService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(Grid) grid?: Grid<Person>;
  @ViewChild(Filter) filter?: Filter<Person>;

  readonly roleOptions = PERSON_ROLES;
  readonly maxBirthDate = todayIsoDate();
  readonly roleControl = this.fb.nonNullable.control<PersonRole | ''>('');
  readonly personId = (person: Person): string => person._id;

  readonly columns: GridColumn<Person>[] = [
    { id: 'name', header: 'Name', value: (person) => person.name, nowrap: true },
    { id: 'cpf', header: 'CPF', nowrap: true },
    { id: 'birth-date', header: 'Birth Date', nowrap: true },
    { id: 'email', header: 'Email', value: (person) => person.email || '—' },
    { id: 'phone', header: 'Phone', nowrap: true },
    { id: 'roles', header: 'Roles' },
    { id: 'custom-roles', header: 'Custom Roles' }
  ];

  readonly filterFields: FilterField<Person>[] = [
    { id: 'name', label: 'Name', match: 'contains', value: (person) => person.name, fullWidth: true },
    { id: 'cpf', label: 'CPF', match: 'digits', value: (person) => person.cpf, inputMode: 'numeric', placeholder: '000.000.000-00' },
    { id: 'birth-date', label: 'Birth Date', match: 'equals', value: (person) => person.birthDate.substring(0, 10), type: 'date' },
    { id: 'email', label: 'Email', match: 'contains', value: (person) => person.email },
    { id: 'phone', label: 'Phone', match: 'digits', value: (person) => person.phone, type: 'tel', placeholder: '(00) 00000-0000' },
    { id: 'custom-role', label: 'Custom Role', match: 'contains', value: (person) => person.custom_roles, fullWidth: true }
  ];

  people: Person[] = [];
  filteredPeople: Person[] = [];
  selectedPerson: Person | null = null;
  editingId: string | null = null;
  personToDelete: Person | null = null;
  activeFilter: FilterValues = {};

  errorMessage = '';
  successMessage = '';
  loading = false;
  listFailed = false;
  loadingPerson = false;
  saving = false;
  deleting = false;
  formOpen = false;
  submitted = false;

  private customRoleSequence = 0;
  private listSubscription?: Subscription;

  readonly personForm = this.fb.nonNullable.group(
    {
      name: ['', requiredTrimmedValidator],
      cpf: ['', [requiredTrimmedValidator, cpfValidator]],
      birthDate: ['', [Validators.required, pastDateValidator]],
      email: ['', emailValidator],
      phone: ['', phoneValidator],
      roles: this.buildRolesGroup(),
      custom_roles: this.fb.array<CustomRoleForm>([], uniqueCustomRolesValidator)
    },
    { validators: customRolesRequiredValidator }
  );

  get customRoles(): FormArray<CustomRoleForm> {
    return this.personForm.controls.custom_roles;
  }

  get isOtherSelected(): boolean {
    return this.personForm.controls.roles.controls.OTHER.value;
  }

  get selectedRoleLabel(): string {
    return this.roleLabel(this.roleControl.value);
  }

  get emptyMessage(): string {
    if (!this.roleControl.value) {
      return 'Select a role to view registered people.';
    }

    if (this.listFailed) {
      return 'People could not be loaded.';
    }

    if (this.people.length > 0) {
      return 'No people match the current filter.';
    }

    return `No people registered with the role ${this.selectedRoleLabel}.`;
  }

  ngOnInit(): void {
    this.roleControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((role) => {
        this.selectedPerson = null;
        this.grid?.resetPage();

        if (role) {
          this.findByRole(role);
        }
      });

    this.personForm.controls.roles.controls.OTHER.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selected) => {
        if (selected && this.customRoles.length === 0) {
          this.addCustomRole();
        }

        if (!selected) {
          this.customRoles.clear();
        }
      });
  }

  create(): void {
    this.saving = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    const person: PersonPayload = this.buildPayload();

    this.peopleService
      .create(person)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving = false;
          this.closeForm();
          this.successMessage = 'Person created successfully';
          this.cdr.detectChanges();
          this.refreshList();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Create person error:', error);

          this.saving = false;
          this.errorMessage = this.buildErrorMessage('create person', error);
          this.cdr.detectChanges();
        }
      });
  }

  update(): void {
    if (!this.editingId) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    const person: PersonPayload = this.buildPayload();

    this.peopleService
      .update(this.editingId, person)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving = false;
          this.closeForm();
          this.successMessage = 'Person updated successfully';
          this.cdr.detectChanges();
          this.refreshList();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Update person error:', error);

          this.saving = false;
          this.errorMessage = this.buildErrorMessage('update person', error);
          this.cdr.detectChanges();
        }
      });
  }

  delete(id: string): void {
    this.deleting = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.peopleService
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting = false;
          this.personToDelete = null;
          this.selectedPerson = null;
          this.successMessage = 'Person deleted successfully';
          this.cdr.detectChanges();
          this.refreshList();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Delete person error:', error);

          this.deleting = false;
          this.personToDelete = null;
          this.errorMessage = this.buildErrorMessage('delete person', error);
          this.cdr.detectChanges();
          this.refreshList();
        }
      });
  }

  findById(id: string): void {
    this.loadingPerson = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.loaderService
      .afterDraw(this.peopleService.findById(id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (person) => {
          this.loadingPerson = false;
          this.edit(person);
          this.cdr.detectChanges();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Find person by ID error:', error);

          this.loadingPerson = false;
          this.errorMessage = this.buildErrorMessage('load person', error);
          this.cdr.detectChanges();
          this.refreshList();
        }
      });
  }

  findByRole(role: PersonRole): void {
    this.listSubscription?.unsubscribe();

    this.loading = true;
    this.listFailed = false;
    this.cdr.detectChanges();

    this.listSubscription = this.loaderService
      .afterDraw(this.peopleService.findByRole(role))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (people) => {
          this.people = people;
          this.loading = false;
          this.updateFilteredPeople();

          const selectedId = this.selectedPerson?._id;
          this.selectedPerson = this.filteredPeople.find((person) => person._id === selectedId) ?? null;

          this.cdr.detectChanges();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Find people by role error:', error);

          this.people = [];
          this.filteredPeople = [];
          this.selectedPerson = null;
          this.loading = false;
          this.listFailed = true;
          this.errorMessage = this.buildErrorMessage('load people', error);
          this.cdr.detectChanges();
        }
      });
  }

  openCreateForm(): void {
    this.resetForm();

    const role = this.roleControl.value;

    if (role) {
      this.personForm.controls.roles.controls[role].setValue(true);
    }

    this.formOpen = true;
  }

  edit(person: Person): void {
    this.resetForm();
    this.editingId = person._id;

    this.personForm.patchValue({
      name: person.name,
      cpf: person.cpf,
      birthDate: person.birthDate.substring(0, 10),
      email: person.email ?? '',
      phone: person.phone ?? ''
    });

    for (const role of person.roles) {
      this.personForm.controls.roles.controls[role]?.setValue(true, { emitEvent: false });
    }

    for (const customRole of person.custom_roles ?? []) {
      this.addCustomRole(customRole);
    }

    if (this.isOtherSelected && this.customRoles.length === 0) {
      this.addCustomRole();
    }

    this.formOpen = true;
  }

  save(): void {
    this.submitted = true;

    if (this.personForm.invalid) {
      this.personForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    if (this.editingId) {
      this.update();
    } else {
      this.create();
    }
  }

  closeForm(): void {
    this.formOpen = false;
    this.resetForm();
  }

  addCustomRole(name = ''): void {
    this.customRoles.push(
      this.fb.nonNullable.group({
        clientId: ++this.customRoleSequence,
        name: [name, requiredTrimmedValidator]
      })
    );
  }

  removeCustomRole(clientId: number): void {
    const index = this.customRoles.controls.findIndex(
      (customRole) => customRole.controls.clientId.value === clientId
    );

    if (index >= 0) {
      this.customRoles.removeAt(index);
    }
  }

  editSelected(): void {
    if (this.selectedPerson) {
      this.findById(this.selectedPerson._id);
    }
  }

  deleteSelected(): void {
    if (this.selectedPerson) {
      this.personToDelete = this.selectedPerson;
    }
  }

  cancelDelete(): void {
    this.personToDelete = null;
  }

  changeFilter(values: FilterValues): void {
    this.activeFilter = values;
    this.selectedPerson = null;
    this.updateFilteredPeople();
    this.grid?.resetPage();
  }

  closeSuccess(): void {
    this.successMessage = '';
  }

  closeError(): void {
    this.errorMessage = '';
  }

  refreshList(): void {
    const role = this.roleControl.value;

    if (role) {
      this.findByRole(role);
    }
  }

  hasError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted);
  }

  roleLabel(role: string): string {
    return this.roleOptions.find((option) => option.value === role)?.label ?? role;
  }

  roleKey(role: string): string {
    return this.roleOptions.find((option) => option.value === role)?.key ?? role.toLowerCase();
  }

  trackByValue(_index: number, value: string): string {
    return value;
  }

  trackByRoleOption(_index: number, option: PersonRoleOption): PersonRole {
    return option.value;
  }

  trackByClientId(_index: number, customRole: CustomRoleForm): number {
    return customRole.controls.clientId.value;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.errorMessage) {
      this.closeError();
    } else if (this.successMessage) {
      this.closeSuccess();
    } else if (this.personToDelete) {
      if (!this.deleting) {
        this.cancelDelete();
      }
    } else if (this.formOpen) {
      if (!this.saving) {
        this.closeForm();
      }
    } else if (this.filter?.isOpen) {
      this.filter.close();
    } else {
      this.selectedPerson = null;
    }
  }

  private updateFilteredPeople(): void {
    this.filteredPeople = filterRows(this.people, this.filterFields, this.activeFilter);
  }

  private resetForm(): void {
    this.editingId = null;
    this.submitted = false;
    this.personForm.reset();
    this.customRoles.clear();
    this.customRoleSequence = 0;
  }

  private buildRolesGroup(): FormGroup<Record<PersonRole, FormControl<boolean>>> {
    const controls = {} as Record<PersonRole, FormControl<boolean>>;

    for (const role of PERSON_ROLES) {
      controls[role.value] = this.fb.nonNullable.control(false);
    }

    return this.fb.group(controls, { validators: atLeastOneRoleValidator });
  }

  private buildPayload(): PersonPayload {
    const value = this.personForm.getRawValue();

    return {
      name: value.name.trim(),
      cpf: value.cpf.trim(),
      birthDate: value.birthDate,
      email: value.email.trim(),
      phone: value.phone.trim(),
      roles: this.roleOptions.map((option) => option.value).filter((role) => value.roles[role]),
      custom_roles: value.roles.OTHER
        ? value.custom_roles.map((customRole) => customRole.name.trim())
        : []
    };
  }

  private buildErrorMessage(action: string, error: HttpErrorResponse): string {
    return `Failed to ${action} (${error.status}): ` + (error.error?.message ?? error.message);
  }
}
