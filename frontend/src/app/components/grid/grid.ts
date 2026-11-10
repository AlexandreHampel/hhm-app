import { AfterContentInit, Component, ContentChildren, EventEmitter, Input, OnChanges, Output, QueryList, SimpleChanges, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Loader } from '../loader/loader';
import { Pagination } from '../pagination/pagination';
import { GridCell, GridCellContext } from './grid-cell';

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

  @Output() selectedRowChange = new EventEmitter<T | null>();

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

  resetPage(): void {
    this.page = 1;
    this.updatePage();
  }

  changePage(page: number): void {
    this.page = page;
    this.updatePage();
    this.clearHiddenSelection();
  }

  changePageSize(pageSize: number): void {
    this.pageSize = pageSize;
    this.page = 1;
    this.updatePage();
    this.clearHiddenSelection();
  }

  toggleRow(row: T): void {
    this.selectedRowChange.emit(this.isSelected(row) ? null : row);
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

  private updatePage(): void {
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
