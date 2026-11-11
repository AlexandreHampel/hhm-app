
import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { Person } from '../../models/people.model';
import { ActivePatient, CHIEF_COMPLAINT_MAX_LENGTH, NOTES_MAX_LENGTH, VISIT_STATUSES, VISIT_TYPES, VisitPayload, VisitType, isProfessional, optionFor } from '../../models/visits.model';
import { PeopleService } from '../../services/people.service';
import { VisitsService } from '../../services/visits.service';
import { LoaderService } from '../../services/loader.service';
import { DatePicker } from '../../components/date-picker/date-picker';
import { Dropdown } from '../../components/dropdown/dropdown';
import { Loader } from '../../components/loader/loader';
import { Finder } from '../../components/finder/finder';
import { MessageDialog } from '../../components/message-dialog/message-dialog';
import { notFutureDateTimeValidator, requiredTrimmedValidator, toDateTimeLocal } from '../../validators/form-validators';
import { PERSON_SEARCH_FIELDS, PROFESSIONAL_COLUMNS, patientColumns, personId, personName } from '../visits/visit-finders';

@Component({
  selector: 'app-visit-new',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePicker, Dropdown, Loader, Finder, MessageDialog],
  templateUrl: './visit-new.html',
  styleUrl: './visit-new.scss'
})

export class VisitNew implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly visitsService = inject(VisitsService);
  private readonly peopleService = inject(PeopleService);
  private readonly loaderService = inject(LoaderService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly typeOptions = VISIT_TYPES;
  readonly chiefComplaintMaxLength = CHIEF_COMPLAINT_MAX_LENGTH;
  readonly notesMaxLength = NOTES_MAX_LENGTH;
  readonly maxAdmissionDate = toDateTimeLocal(new Date());
  readonly personId = personId;
  readonly personName = personName;
  readonly searchFields = PERSON_SEARCH_FIELDS;
  readonly professionalColumns = PROFESSIONAL_COLUMNS;
  readonly patientColumns = patientColumns((patient) =>
    this.isUnavailable(patient) ? `Active visit (${this.activeStatusLabel(patient)})` : 'Available'
  );

  activeVisits = new Map<string, ActivePatient>();
  patients: Person[] = [];
  professionals: Person[] = [];
  professionalOptions: Person[] = [];

  readonly visitForm = this.fb.nonNullable.group({
    patientId: ['', [Validators.required, (control: AbstractControl<string>) => this.availablePatientValidator(control)]],
    type: this.fb.nonNullable.control<VisitType | ''>('', Validators.required),
    attendingProfessionalId: '',
    admissionDate: [toDateTimeLocal(new Date()), [Validators.required, notFutureDateTimeValidator]],
    chiefComplaint: ['', [requiredTrimmedValidator, Validators.maxLength(CHIEF_COMPLAINT_MAX_LENGTH)]],
    notes: ['', Validators.maxLength(NOTES_MAX_LENGTH)]
  });

  errorMessage = '';
  loadingOptions = false;
  optionsFailed = false;
  saving = false;
  submitted = false;

  readonly isUnavailable = (patient: Person): boolean => this.activeVisits.has(patient._id);

  ngOnInit(): void {
    this.visitForm.controls.patientId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((patientId) => {
        if (patientId && this.visitForm.controls.attendingProfessionalId.value === patientId) {
          this.visitForm.controls.attendingProfessionalId.setValue('');
        }

        this.updateProfessionalOptions();
      });

    this.loadOptions();
  }

  loadOptions(): void {
    this.loadingOptions = true;
    this.optionsFailed = false;
    this.cdr.detectChanges();

    this.loaderService
      .afterDraw(forkJoin({
        patients: this.peopleService.findByRole('PATIENT'),
        people: this.peopleService.findAll(),
        activePatients: this.visitsService.findActivePatients()
      }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ patients, people, activePatients }) => {
          this.setActiveVisits(activePatients);
          this.patients = patients;
          this.professionals = people.filter((person) => isProfessional(person));
          this.updateProfessionalOptions();
          this.loadingOptions = false;
          this.cdr.detectChanges();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Load visit form options error:', error);

          this.loadingOptions = false;
          this.optionsFailed = true;
          this.errorMessage = this.buildErrorMessage('load patients and professionals', error);
          this.cdr.detectChanges();
        }
      });
  }

  save(): void {
    this.submitted = true;

    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.visitsService
      .create(this.buildPayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (visit) => {
          this.saving = false;
          this.router.navigate(['/visits/id', visit._id], {
            skipLocationChange: true,
            state: { successMessage: 'Visit created successfully' }
          });
        },
        error: (error: HttpErrorResponse) => {
          console.error('Create visit error:', error);

          this.saving = false;
          this.errorMessage = this.buildErrorMessage('create visit', error);
          this.cdr.detectChanges();

          if (error.status === 409) {
            this.refreshActivePatients();
          }
        }
      });
  }

  hasError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted);
  }

  closeError(): void {
    this.errorMessage = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.errorMessage) {
      this.closeError();
    }
  }

  // A person cannot be the attending professional of their own visit.
  private updateProfessionalOptions(): void {
    const patientId = this.visitForm.controls.patientId.value;
    this.professionalOptions = this.professionals.filter((professional) => professional._id !== patientId);
  }

  private activeStatusLabel(patient: Person): string {
    const activeVisit = this.activeVisits.get(patient._id);
    return activeVisit ? optionFor(VISIT_STATUSES, activeVisit.status).label : '';
  }

  // Patients with an active visit cannot be selected. The API also rejects
  // them (409); this keeps the form consistent if the list changes meanwhile.
  private availablePatientValidator(control: AbstractControl<string>): ValidationErrors | null {
    return control.value && this.activeVisits.has(control.value) ? { patientUnavailable: true } : null;
  }

  private refreshActivePatients(): void {
    this.visitsService
      .findActivePatients()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activePatients) => {
          this.setActiveVisits(activePatients);
          // New array reference so the finder refreshes the availability column.
          this.patients = [...this.patients];
          this.cdr.detectChanges();
        },
        error: (error: HttpErrorResponse) => console.error('Find active patients error:', error)
      });
  }

  private setActiveVisits(activePatients: ActivePatient[]): void {
    this.activeVisits = new Map(activePatients.map((activePatient) => [activePatient.patientId, activePatient]));
    this.visitForm.controls.patientId.updateValueAndValidity();
  }

  private buildPayload(): VisitPayload {
    const value = this.visitForm.getRawValue();

    return {
      patientId: value.patientId,
      type: value.type as VisitType,
      admissionDate: new Date(value.admissionDate).toISOString(),
      attendingProfessionalId: value.attendingProfessionalId || null,
      chiefComplaint: value.chiefComplaint.trim(),
      notes: value.notes.trim()
    };
  }

  private buildErrorMessage(action: string, error: HttpErrorResponse): string {
    return `Failed to ${action} (${error.status}): ` + (error.error?.message ?? error.message);
  }
}
