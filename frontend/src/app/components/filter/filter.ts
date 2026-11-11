import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FormDialog } from '../form-dialog/form-dialog';
import { Dropdown } from '../dropdown/dropdown';
import { DatePicker } from '../date-picker/date-picker';
import { Finder } from '../finder/finder';
import { FilterField, FilterValues } from './filter-fields';

export type { FilterField, FilterFinder, FilterMatch, FilterValues } from './filter-fields';
export { filterRows } from './filter-fields';

@Component({
  selector: 'app-filter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, FormDialog, Dropdown, DatePicker, Finder],
  templateUrl: './filter.html',
  styleUrl: './filter.scss'
})

export class Filter<T> implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) testIdPrefix!: string;
  @Input({ required: true }) fields: FilterField<T>[] = [];
  @Input() title = 'Filter';

  @Output() filterChange = new EventEmitter<FilterValues>();

  form: FormGroup<Record<string, FormControl<string>>> = this.fb.nonNullable.group({});
  activeValues: FilterValues = {};
  isOpen = false;

  get activeCount(): number {
    return Object.values(this.activeValues).filter(Boolean).length;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      const controls: Record<string, FormControl<string>> = {};

      for (const field of this.fields) {
        controls[field.id] = this.fb.nonNullable.control('');
      }

      this.form = this.fb.nonNullable.group(controls);
    }
  }

  open(): void {
    this.form.reset();
    this.form.patchValue(this.activeValues);
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  apply(): void {
    const values: FilterValues = {};

    for (const [id, value] of Object.entries(this.form.getRawValue())) {
      if (value.trim()) {
        values[id] = value.trim();
      }
    }

    this.activeValues = values;
    this.isOpen = false;
    this.filterChange.emit({ ...values });
  }

  clear(): void {
    this.form.reset();
    this.apply();
  }

  trackByField(_index: number, field: FilterField<T>): string {
    return field.id;
  }
}
