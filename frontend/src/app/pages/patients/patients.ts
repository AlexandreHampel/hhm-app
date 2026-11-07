
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Patient, PatientPayload } from '../../models/patients.model';
import { PatientsService } from '../../services/patients.service';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './patients.html'
})

export class Patients implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly patientsService = inject(PatientsService);
  private readonly cdr = inject(ChangeDetectorRef);

  patients: Patient[] = [];
  editingId: string | null = null;

  errorMessage = '';
  successMessage = '';
  loading = false;

  patientForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    cpf: ['', Validators.required],
    birthDate: ['', Validators.required],
    email: [''],
    phone: ['']
  });

  ngOnInit(): void {
    this.findAll();
  }

  create(): void {
    if (this.patientForm.invalid) {
      this.patientForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    const patient: PatientPayload = this.patientForm.getRawValue();

    this.patientsService.create(patient).subscribe({
      next: () => {
        this.resetForm();
        this.successMessage = 'Patient created successfully';
        this.cdr.detectChanges();
        this.findAll();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Create patient error:', error);

        this.loading = false;
        this.errorMessage =
          `Failed to create patient (${error.status}): ` +
          (error.error?.message ?? error.message);

        this.cdr.detectChanges();
      }
    });
  }

  update(): void {
    if (!this.editingId || this.patientForm.invalid) {
      this.patientForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    const patient: PatientPayload = this.patientForm.getRawValue();

    this.patientsService.update(this.editingId, patient).subscribe({
      next: () => {
        this.resetForm();
        this.successMessage = 'Patient updated successfully';
        this.cdr.detectChanges();
        this.findAll();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Update patient error:', error);

        this.loading = false;
        this.errorMessage =
          `Failed to update patient (${error.status}): ` +
          (error.error?.message ?? error.message);

        this.cdr.detectChanges();
      }
    });
  }

  delete(id: string): void {
    if (!confirm('Are you sure you want to delete this patient?')) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.patientsService.delete(id).subscribe({
      next: () => {
        if (this.editingId === id) {
          this.resetForm();
        }

        this.successMessage = 'Patient deleted successfully';
        this.cdr.detectChanges();
        this.findAll();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Delete patient error:', error);

        this.loading = false;
        this.errorMessage =
          `Failed to delete patient (${error.status}): ` +
          (error.error?.message ?? error.message);

        this.cdr.detectChanges();

        this.findAll();
      }
    });
  }

  findAll(): void {
    this.loading = true;
    this.cdr.detectChanges();

    this.patientsService.findAll().subscribe({
      next: (patients) => {
        this.patients = patients;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Find all patients error:', error);

        this.loading = false;
        this.errorMessage =
          `Failed to load patients (${error.status}): ` +
          (error.error?.message ?? error.message);

        this.cdr.detectChanges();
      }
    });
  }

  findById(id: string): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.patientsService.findById(id).subscribe({
      next: (patient) => {
        this.loading = false;
        this.edit(patient);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Find patient by ID error:', error);

        this.loading = false;
        this.errorMessage =
          `Failed to find patient by ID (${error.status}): ` +
          (error.error?.message ?? error.message);

        this.cdr.detectChanges();
      }
    });
  }

  findByCpf(cpf: string): void {
    if (!cpf.trim()) {
      this.findAll();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.patientsService.findByCpf(cpf.trim()).subscribe({
      next: (patient) => {
        this.patients = [patient];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Find patient by CPF error:', error);

        this.patients = [];
        this.loading = false;
        this.errorMessage =
          `Failed to find patient by CPF (${error.status}): ` +
          (error.error?.message ?? error.message);

        this.cdr.detectChanges();
      }
    });
  }

  edit(patient: Patient): void {
    this.editingId = patient._id;
    this.errorMessage = '';
    this.successMessage = '';

    this.patientForm.patchValue({
      name: patient.name,
      cpf: patient.cpf,
      birthDate: patient.birthDate.substring(0, 10),
      email: patient.email ?? '',
      phone: patient.phone ?? ''
    });

    this.cdr.detectChanges();
  }

  save(): void {
    if (this.editingId) {
      this.update();
    } else {
      this.create();
    }
  }

  resetForm(): void {
    this.editingId = null;
    this.patientForm.reset();
    this.errorMessage = '';
    this.cdr.detectChanges();
  }
}
