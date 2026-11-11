import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, Dropdown],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss'
})

export class Pagination {
  @Input({ required: true }) testIdPrefix!: string;
  @Input() totalItems = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50];

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get pageSizeDropdownOptions(): DropdownOption[] {
    return this.pageSizeOptions.map((option) => ({
      value: option.toString(),
      label: option.toString(),
      key: option.toString()
    }));
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get firstItem(): number {
    return this.totalItems === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get lastItem(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }

  goTo(page: number): void {
    const target = Math.min(Math.max(page, 1), this.totalPages);

    if (target !== this.page) {
      this.pageChange.emit(target);
    }
  }

  changePageSize(value: string): void {
    const pageSize = Number(value);

    if (pageSize !== this.pageSize) {
      this.pageSizeChange.emit(pageSize);
    }
  }
}