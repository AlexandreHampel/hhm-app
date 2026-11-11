import { AfterContentInit, Component, ContentChildren, EventEmitter, Input, OnChanges, Output, QueryList, SimpleChanges, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Loader } from '../loader/loader';
import { Pagination } from '../pagination/pagination';
import { GridCell, GridCellContext } from './grid-cell';

export interface GridPageRequest {
  page: number;
  pageSize: number;
}

export interface GridColumn<T> {
  id: string;
  header: string;
  value?: (row: T) => string | number | null | undefined;
  nowrap?: boolean;
}

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [CommonModule, Loader, Pagination],
  templateUrl: './grid.html',
  styleUrl: './grid.scss'
})

export class Grid<T> implements OnChanges, AfterContentInit {
  @Input({ required: true }) testIdPrefix!: string;
  @Input({ required: true }) columns: GridColumn<T>[] = [];
  @Input({ required: true }) rows: T[] = [];
  @Input({ required: true }) rowId!: (row: T) => string;
  @Input({ required: true }) emptyMessage!: string;
  @Input() loading = false;
  @Input() loadingMessage = 'Loading...';
  @Input() ariaLabel = 'Records';
  @Input() selectedRow: T | null = null;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50];
  // Server-side pagination: when set, rows are the current page already loaded
  // and page changes are emitted for the parent to load the requested page.
  @Input() totalItems: number | null = null;
  // Rows that are shown but cannot be selected.
  @Input() rowDisabled: ((row: T) => boolean) | null = null;

  @Output() selectedRowChange = new EventEmitter<T | null>();
  @Output() pageRequest = new EventEmitter<GridPageRequest>();

  @ContentChildren(GridCell) cellTemplates?: QueryList<GridCell>;

  page = 1;
  pageSize = 10;
  pagedRows: T[] = [];

  private templates = new Map<string, TemplateRef<GridCellContext>>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rows']) {
      this.updatePage();
    }
  }

  ngAfterContentInit(): void {
    this.cellTemplates?.changes.subscribe(() => this.collectTemplates());
    this.collectTemplates();
  }

  get isServerSide(): boolean {
    return this.totalItems !== null;
  }

  resetPage(): void {
    this.page = 1;
    this.updatePage();
  }

  changePage(page: number): void {
    this.page = page;
    this.updatePage();
    this.clearHiddenSelection();
    this.emitPageRequest();
  }

  changePageSize(pageSize: number): void {
    this.pageSize = pageSize;
    this.page = 1;
    this.updatePage();
    this.clearHiddenSelection();
    this.emitPageRequest();
  }

  toggleRow(row: T): void {
    if (this.isDisabled(row)) {
      return;
    }

    this.selectedRowChange.emit(this.isSelected(row) ? null : row);
  }

  isDisabled(row: T): boolean {
    return this.rowDisabled?.(row) ?? false;
  }

  isSelected(row: T): boolean {
    return this.selectedRow !== null && this.rowId(this.selectedRow) === this.rowId(row);
  }

  templateFor(columnId: string): TemplateRef<GridCellContext> | null {
    return this.templates.get(columnId) ?? null;
  }

  cellValue(column: GridColumn<T>, row: T): string | number {
    return column.value?.(row) ?? '';
  }

  trackByColumn(_index: number, column: GridColumn<T>): string {
    return column.id;
  }

  trackByRow = (_index: number, row: T): string => this.rowId(row);

  private emitPageRequest(): void {
    if (this.isServerSide) {
      this.pageRequest.emit({ page: this.page, pageSize: this.pageSize });
    }
  }

  private updatePage(): void {
    if (this.isServerSide) {
      this.pagedRows = this.rows;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(this.rows.length / this.pageSize));
    this.page = Math.min(this.page, totalPages);

    const start = (this.page - 1) * this.pageSize;
    this.pagedRows = this.rows.slice(start, start + this.pageSize);
  }

  private clearHiddenSelection(): void {
    if (this.selectedRow && !this.pagedRows.some((row) => this.isSelected(row))) {
      this.selectedRowChange.emit(null);
    }
  }

  private collectTemplates(): void {
    this.templates = new Map(
      (this.cellTemplates?.toArray() ?? []).map((cell) => [cell.columnId, cell.template])
    );
  }
}
