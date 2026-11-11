
import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { VISIT_STATUSES, VISIT_TYPES, Visit, VisitFilters, VisitOption, VisitStatus, VisitType, optionFor } from '../../models/visits.model';
import { VisitsService } from '../../services/visits.service';
import { LoaderService } from '../../services/loader.service';
import { Grid, GridColumn, GridPageRequest } from '../../components/grid/grid';
import { GridCell } from '../../components/grid/grid-cell';
import { Filter, FilterField, FilterValues } from '../../components/filter/filter';
import { MessageDialog } from '../../components/message-dialog/message-dialog';

@Component({
  selector: 'app-visits',
  standalone: true,
  imports: [CommonModule, RouterLink, Filter, Grid, GridCell, MessageDialog],
  templateUrl: './visits.html',
  styleUrl: './visits.scss'
})

export class Visits implements OnInit {
  private readonly visitsService = inject(VisitsService);
  private readonly loaderService = inject(LoaderService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(Grid) grid?: Grid<Visit>;
  @ViewChild(Filter) filter?: Filter<Visit>;

  readonly visitId = (visit: Visit): string => visit._id;

  readonly columns: GridColumn<Visit>[] = [
    { id: 'patient', header: 'Patient', value: (visit) => visit.patient?.name ?? 'Unknown patient', nowrap: true },
    { id: 'type', header: 'Type', value: (visit) => optionFor(VISIT_TYPES, visit.type).label, nowrap: true },
    { id: 'admission-date', header: 'Admission', nowrap: true },
    { id: 'status', header: 'Status' },
    { id: 'professional', header: 'Responsible Professional', value: (visit) => visit.attendingProfessional?.name ?? '—' }
  ];

  readonly filterFields: FilterField<Visit>[] = [
    { id: 'patient-name', label: 'Patient Name', fullWidth: true },
    { id: 'patient-cpf', label: 'Patient CPF', inputMode: 'numeric', placeholder: '000.000.000-00' },
    { id: 'professional', label: 'Responsible Professional' },
    { id: 'type', label: 'Visit Type', type: 'select', options: VISIT_TYPES },
    { id: 'status', label: 'Status', type: 'select', options: VISIT_STATUSES },
    { id: 'admission-from', label: 'Admitted From', type: 'date' },
    { id: 'admission-to', label: 'Admitted To', type: 'date' },
    { id: 'chief-complaint', label: 'Chief Complaint', fullWidth: true }
  ];

  activeFilter: FilterValues = {};
  visits: Visit[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  selectedVisit: Visit | null = null;

  errorMessage = '';
  loading = false;
  listFailed = false;

  private listSubscription?: Subscription;

  get invalidDateRange(): boolean {
    const from = this.activeFilter['admission-from'];
    const to = this.activeFilter['admission-to'];

    return !!from && !!to && from > to;
  }

  get emptyMessage(): string {
    if (this.listFailed) {
      return 'Visits could not be loaded.';
    }

    return Object.keys(this.activeFilter).length > 0
      ? 'No visits match the current filter.'
      : 'No visits registered yet.';
  }

  ngOnInit(): void {
    this.findAll();
  }

  findAll(): void {
    this.listSubscription?.unsubscribe();
    this.selectedVisit = null;

    if (this.invalidDateRange) {
      this.visits = [];
      this.total = 0;
      this.loading = false;
      this.errorMessage = 'Admitted From must be on or before Admitted To.';
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.listFailed = false;
    this.cdr.detectChanges();

    this.listSubscription = this.loaderService
      .afterDraw(this.visitsService.findAll(this.buildFilters()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.visits = result.items;
          this.total = result.total;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Find visits error:', error);

          this.visits = [];
          this.total = 0;
          this.loading = false;
          this.listFailed = true;
          this.errorMessage = this.buildErrorMessage('load visits', error);
          this.cdr.detectChanges();
        }
      });
  }

  changePage(request: GridPageRequest): void {
    this.page = request.page;
    this.pageSize = request.pageSize;
    this.findAll();
  }

  viewDetails(): void {
    if (this.selectedVisit) {
      this.router.navigate(['/visits/id', this.selectedVisit._id], { skipLocationChange: true });
    }
  }

  changeFilter(values: FilterValues): void {
    this.activeFilter = values;
    this.page = 1;
    this.grid?.resetPage();
    this.findAll();
  }

  closeError(): void {
    this.errorMessage = '';
  }

  statusOption(status: VisitStatus): VisitOption<VisitStatus> {
    return optionFor(VISIT_STATUSES, status);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.errorMessage) {
      this.closeError();
    } else if (this.filter?.isOpen) {
      this.filter.close();
    } else {
      this.selectedVisit = null;
    }
  }

  // Date filters are whole local days, sent to the API as exact instants.
  private buildFilters(): VisitFilters {
    const filter = this.activeFilter;
    const admissionFrom = filter['admission-from'];
    const admissionTo = filter['admission-to'];

    return {
      patientName: filter['patient-name'],
      patientCpf: filter['patient-cpf'],
      professionalName: filter['professional'],
      chiefComplaint: filter['chief-complaint'],
      type: filter['type'] as VisitType | undefined,
      status: filter['status'] as VisitStatus | undefined,
      admissionFrom: admissionFrom ? new Date(`${admissionFrom}T00:00:00`).toISOString() : undefined,
      admissionTo: admissionTo ? new Date(`${admissionTo}T23:59:59.999`).toISOString() : undefined,
      page: this.page,
      limit: this.pageSize
    };
  }

  private buildErrorMessage(action: string, error: HttpErrorResponse): string {
    return `Failed to ${action} (${error.status}): ` + (error.error?.message ?? error.message);
  }
}
