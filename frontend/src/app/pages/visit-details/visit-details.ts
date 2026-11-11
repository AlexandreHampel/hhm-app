
import { ChangeDetectorRef, Component, DestroyRef, HostListener, LOCALE_ID, OnInit, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, forkJoin } from 'rxjs';
import { Person } from '../../models/people.model';
import { CHIEF_COMPLAINT_MAX_LENGTH, CLOSING_MOVEMENT_TYPES, DEPARTMENT_MAX_LENGTH, DESCRIPTION_MAX_LENGTH, NOTES_MAX_LENGTH, VISIT_MOVEMENT_TYPES, VISIT_STATUSES, VISIT_TYPES, Visit, VisitMovement, VisitMovementPayload, VisitMovementType, VisitOption, VisitStatus, VisitType, VisitUpdatePayload, isActiveVisit, isProfessional, optionFor } from '../../models/visits.model';
import { PeopleService } from '../../services/people.service';
import { VisitsService } from '../../services/visits.service';
import { LoaderService } from '../../services/loader.service';
import { DatePicker } from '../../components/date-picker/date-picker';
import { Dropdown } from '../../components/dropdown/dropdown';
import { FormDialog } from '../../components/form-dialog/form-dialog';
import { Loader } from '../../components/loader/loader';
import { Finder } from '../../components/finder/finder';
import { MessageDialog } from '../../components/message-dialog/message-dialog';
import { CpfPipe } from '../../pipes/cpf';
import { notFutureDateTimeValidator, requiredTrimmedValidator, toDateTimeLocal } from '../../validators/form-validators';
import { PERSON_SEARCH_FIELDS, PROFESSIONAL_COLUMNS, personId, personName } from '../visits/visit-finders';

interface MovementFormValue {
  type: VisitMovementType | '';
  useCurrentTime: boolean;
  occurredAt: string;
  departmentFrom: string;
  departmentTo: string;
  responsibleProfessionalId: string;
  description: string;
}

@Component({
  selector: 'app-visit-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePicker, Dropdown, FormDialog, Loader, Finder, MessageDialog, CpfPipe],
  templateUrl: './visit-details.html',
  styleUrl: './visit-details.scss'
})

export class VisitDetails implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly visitsService = inject(VisitsService);
  private readonly peopleService = inject(PeopleService);
  private readonly loaderService = inject(LoaderService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  readonly typeOptions = VISIT_TYPES;
  readonly movementTypeOptions = VISIT_MOVEMENT_TYPES;
  readonly chiefComplaintMaxLength = CHIEF_COMPLAINT_MAX_LENGTH;
  readonly notesMaxLength = NOTES_MAX_LENGTH;
  readonly departmentMaxLength = DEPARTMENT_MAX_LENGTH;
  readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;
  readonly personId = personId;
  readonly personName = personName;
  readonly searchFields = PERSON_SEARCH_FIELDS;
  readonly professionalColumns = PROFESSIONAL_COLUMNS;

  visitId = '';
  visit: Visit | null = null;
  movements: VisitMovement[] = [];
  professionals: Person[] = [];
  professionalOptions: Person[] = [];
  pendingMovement: VisitMovementPayload | null = null;

  // Message sent by the page that navigated here (e.g. after creating the
  // visit). Read while the navigation is still in progress.
  successMessage = (this.router.currentNavigation()?.extras.state?.['successMessage'] as string | undefined) ?? '';
  errorMessage = '';
  readOnlyMessage = '';
  loading = false;
  notFound = false;
  loadFailed = false;
  editOpen = false;
  editSubmitted = false;
  savingEdit = false;
  movementOpen = false;
  movementSubmitted = false;
  savingMovement = false;

  readonly editForm = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<VisitType | ''>('', Validators.required),
    attendingProfessionalId: '',
    chiefComplaint: ['', [requiredTrimmedValidator, Validators.maxLength(CHIEF_COMPLAINT_MAX_LENGTH)]],
    notes: ['', Validators.maxLength(NOTES_MAX_LENGTH)]
  });

  readonly movementForm = this.fb.nonNullable.group(
    {
      type: this.fb.nonNullable.control<VisitMovementType | ''>('', Validators.required),
      useCurrentTime: true,
      occurredAt: ['', notFutureDateTimeValidator],
      departmentFrom: ['', Validators.maxLength(DEPARTMENT_MAX_LENGTH)],
      departmentTo: ['', Validators.maxLength(DEPARTMENT_MAX_LENGTH)],
      responsibleProfessionalId: '',
      description: ['', Validators.maxLength(DESCRIPTION_MAX_LENGTH)]
    },
    { validators: (group: AbstractControl) => this.movementRulesValidator(group) }
  );

  private loadSubscription?: Subscription;

  get isActive(): boolean {
    return !!this.visit && isActiveVisit(this.visit);
  }

  // Department where the patient currently is: destination of the latest
  // movement that recorded one (movements are in chronological order).
  get currentDepartment(): string | null {
    for (let index = this.movements.length - 1; index >= 0; index--) {
      const departmentTo = this.movements[index].departmentTo;

      if (departmentTo) {
        return departmentTo;
      }
    }

    return null;
  }

  // Earliest instant accepted for a new movement: the admission or the latest movement.
  get minimumOccurredAt(): Date | null {
    if (!this.visit) {
      return null;
    }

    const latestMovement = this.movements[this.movements.length - 1];
    return new Date(latestMovement?.occurredAt ?? this.visit.admissionDate);
  }

  get minimumOccurredAtLocal(): string | null {
    const minimum = this.minimumOccurredAt;
    return minimum ? toDateTimeLocal(minimum) : null;
  }

  get nowLocal(): string {
    return toDateTimeLocal(new Date());
  }

  get movementType(): VisitMovementType | '' {
    return this.movementForm.controls.type.value;
  }

  get confirmationTitle(): string {
    return this.pendingMovement?.type === 'DISCHARGE' ? 'Confirm Discharge' : 'Confirm Cancellation';
  }

  get confirmationMessage(): string {
    return this.pendingMovement?.type === 'DISCHARGE'
      ? 'Recording the discharge closes this visit as Completed. It will become read-only and cannot receive new movements. Do you want to continue?'
      : 'Recording the cancellation closes this visit as Cancelled. It will become read-only and cannot receive new movements. Do you want to continue?';
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.visitId = params.get('id') ?? '';
        this.load();
      });

    this.movementForm.controls.useCurrentTime.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((useCurrentTime) => {
        if (!useCurrentTime && !this.movementForm.controls.occurredAt.value) {
          this.movementForm.controls.occurredAt.setValue(toDateTimeLocal(new Date()));
        }
      });

    this.loadProfessionals();
  }

  load(): void {
    this.loadSubscription?.unsubscribe();

    this.loading = !this.visit;
    this.notFound = false;
    this.loadFailed = false;
    this.cdr.detectChanges();

    this.loadSubscription = this.loaderService
      .afterDraw(forkJoin({
        visit: this.visitsService.findById(this.visitId),
        movements: this.visitsService.findMovements(this.visitId)
      }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ visit, movements }) => {
          // Opening a closed visit informs that it is read-only. Closing it on
          // this page is already confirmed by the success message.
          if (!this.visit && !isActiveVisit(visit)) {
            this.readOnlyMessage = this.buildReadOnlyMessage(visit);
          }

          this.visit = visit;
          this.movements = movements;
          this.updateProfessionalOptions();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Find visit error:', error);

          this.visit = null;
          this.movements = [];
          this.loading = false;
          this.notFound = error.status === 404 || error.status === 400;
          this.loadFailed = !this.notFound;

          if (this.loadFailed) {
            this.errorMessage = this.buildErrorMessage('load visit', error);
          }

          this.cdr.detectChanges();
        }
      });
  }

  openEdit(): void {
    if (!this.visit) {
      return;
    }

    this.editSubmitted = false;
    this.editForm.reset({
      type: this.visit.type,
      attendingProfessionalId: this.visit.attendingProfessionalId ?? '',
      chiefComplaint: this.visit.chiefComplaint,
      notes: this.visit.notes ?? ''
    });
    this.editOpen = true;
  }

  closeEdit(): void {
    this.editOpen = false;
  }

  saveEdit(): void {
    this.editSubmitted = true;

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    const value = this.editForm.getRawValue();
    const payload: VisitUpdatePayload = {
      type: value.type as VisitType,
      attendingProfessionalId: value.attendingProfessionalId || null,
      chiefComplaint: value.chiefComplaint.trim(),
      notes: value.notes.trim()
    };

    this.savingEdit = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.visitsService
      .update(this.visitId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingEdit = false;
          this.editOpen = false;
          this.successMessage = 'Visit updated successfully';
          this.cdr.detectChanges();
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Update visit error:', error);

          this.savingEdit = false;
          this.errorMessage = this.buildErrorMessage('update visit', error);

          if (error.status === 409) {
            this.editOpen = false;
            this.load();
          }

          this.cdr.detectChanges();
        }
      });
  }

  openMovement(): void {
    this.movementSubmitted = false;
    this.pendingMovement = null;
    this.movementForm.reset({
      type: '',
      useCurrentTime: true,
      occurredAt: '',
      departmentFrom: '',
      departmentTo: '',
      responsibleProfessionalId: '',
      description: ''
    });
    this.movementOpen = true;
  }

  closeMovement(): void {
    this.movementOpen = false;
    this.pendingMovement = null;
  }

  submitMovement(): void {
    this.movementSubmitted = true;

    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    const payload = this.buildMovementPayload();

    // Discharge and cancellation close the visit: ask for explicit confirmation.
    if (CLOSING_MOVEMENT_TYPES.includes(payload.type)) {
      this.pendingMovement = payload;
      this.cdr.detectChanges();
      return;
    }

    this.createMovement(payload);
  }

  confirmClosingMovement(): void {
    if (this.pendingMovement) {
      this.createMovement(this.pendingMovement);
    }
  }

  cancelClosingMovement(): void {
    this.pendingMovement = null;
  }

  closeSuccess(): void {
    this.successMessage = '';
  }

  closeError(): void {
    this.errorMessage = '';
  }

  closeReadOnlyMessage(): void {
    this.readOnlyMessage = '';
  }

  hasError(control: AbstractControl, submitted: boolean): boolean {
    return control.invalid && (control.touched || submitted);
  }

  hasGroupError(error: string): boolean {
    return this.movementForm.hasError(error) && (this.movementSubmitted || this.movementForm.touched);
  }

  typeOption(type: VisitType): VisitOption<VisitType> {
    return optionFor(VISIT_TYPES, type);
  }

  statusOption(status: VisitStatus): VisitOption<VisitStatus> {
    return optionFor(VISIT_STATUSES, status);
  }

  movementOption(type: VisitMovementType): VisitOption<VisitMovementType> {
    return optionFor(VISIT_MOVEMENT_TYPES, type);
  }

  trackById(_index: number, record: { _id: string }): string {
    return record._id;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.errorMessage) {
      this.closeError();
    } else if (this.successMessage) {
      this.closeSuccess();
    } else if (this.readOnlyMessage) {
      this.closeReadOnlyMessage();
    } else if (this.pendingMovement) {
      if (!this.savingMovement) {
        this.cancelClosingMovement();
      }
    } else if (this.movementOpen) {
      if (!this.savingMovement) {
        this.closeMovement();
      }
    } else if (this.editOpen && !this.savingEdit) {
      this.closeEdit();
    }
  }

  private createMovement(payload: VisitMovementPayload): void {
    this.savingMovement = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.visitsService
      .createMovement(this.visitId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (movement) => {
          this.savingMovement = false;
          this.movementOpen = false;
          this.pendingMovement = null;
          this.successMessage = `${this.movementOption(movement.type).label} recorded successfully`;
          this.cdr.detectChanges();
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Create movement error:', error);

          this.savingMovement = false;
          this.pendingMovement = null;
          this.errorMessage = this.buildErrorMessage('record movement', error);

          if (error.status === 409) {
            this.movementOpen = false;
            this.load();
          }

          this.cdr.detectChanges();
        }
      });
  }

  private loadProfessionals(): void {
    this.peopleService
      .findAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (people) => {
          this.professionals = people.filter((person) => isProfessional(person));
          this.updateProfessionalOptions();
          this.cdr.detectChanges();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Find professionals error:', error);

          this.errorMessage = this.buildErrorMessage('load professionals', error);
          this.cdr.detectChanges();
        }
      });
  }

  // Eligible professionals, never the visit patient.
  private updateProfessionalOptions(): void {
    this.professionalOptions = this.professionals.filter(
      (professional) => professional._id !== this.visit?.patientId
    );
  }

  private movementRulesValidator(group: AbstractControl): ValidationErrors | null {
    const value = group.getRawValue() as MovementFormValue;
    const errors: ValidationErrors = {};

    if (value.type === 'DEPARTMENT_TRANSFER') {
      const origin = (this.currentDepartment ?? value.departmentFrom).trim();
      const destination = value.departmentTo.trim();

      if (!destination) {
        errors['departmentToRequired'] = true;
      } else if (origin && origin.toLocaleLowerCase() === destination.toLocaleLowerCase()) {
        errors['sameDepartment'] = true;
      }
    }

    if (value.type === 'OTHER' && !value.description.trim()) {
      errors['descriptionRequired'] = true;
    }

    if (!value.useCurrentTime) {
      const minimum = this.minimumOccurredAt;

      if (!value.occurredAt) {
        errors['occurredAtRequired'] = true;
      } else if (minimum && new Date(value.occurredAt).getTime() < minimum.getTime()) {
        errors['occurredAtTooEarly'] = true;
      }
    }

    return Object.keys(errors).length ? errors : null;
  }

  private buildMovementPayload(): VisitMovementPayload {
    const value = this.movementForm.getRawValue();
    const type = value.type as VisitMovementType;
    const isTransfer = type === 'DEPARTMENT_TRANSFER';

    return {
      type,
      // Omitted when using the current time: the server records its own time.
      occurredAt: value.useCurrentTime ? undefined : new Date(value.occurredAt).toISOString(),
      departmentFrom: isTransfer ? (this.currentDepartment ?? value.departmentFrom.trim()) || undefined : undefined,
      departmentTo: isTransfer ? value.departmentTo.trim() : undefined,
      responsibleProfessionalId: value.responsibleProfessionalId || null,
      description: value.description.trim() || undefined
    };
  }

  private buildReadOnlyMessage(visit: Visit): string {
    const closedAt = visit.closedAt ? ` on ${formatDate(visit.closedAt, 'dd/MM/yyyy HH:mm', this.locale)}` : '';
    const outcome = visit.status === 'COMPLETED' ? 'completed' : 'cancelled';

    return `This visit was ${outcome}${closedAt}. It is read-only.`;
  }

  private buildErrorMessage(action: string, error: HttpErrorResponse): string {
    return `Failed to ${action} (${error.status}): ` + (error.error?.message ?? error.message);
  }
}
