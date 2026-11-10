import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FormDialog } from '../form-dialog/form-dialog';

export type FilterMatch = 'contains' | 'digits' | 'equals';

export type FilterValues = Record<string, string>;

export interface FilterField<T> {
  id: string;
  label: string;
  match: FilterMatch;
  value: (row: T) => string | string[] | null | undefined;
  type?: 'text' | 'date' | 'tel' | 'email';
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  placeholder?: string;
  fullWidth?: boolean;
}

export function filterRows<T>(rows: T[], fields: FilterField<T>[], values: FilterValues): T[] {
  const criteria = fields.filter((field) => values[field.id]);

  if (criteria.length === 0) {
    return rows;
  }

  return rows.filter((row) =>
    criteria.every((field) => matchesField(field.value(row), values[field.id], field.match))
  );
}

function matchesField(rawValue: string | string[] | null | undefined, query: string, match: FilterMatch): boolean {
  const values = (Array.isArray(rawValue) ? rawValue : [rawValue ?? '']).map((value) => value ?? '');

  switch (match) {
    case 'digits': {
      const digits = query.replace(/\D/g, '');
      return digits.length > 0 && values.some((value) => value.replace(/\D/g, '').includes(digits));
    }
    case 'equals':
      return values.some((value) => value === query);
    default: {
      const text = query.toLocaleLowerCase();
      return values.some((value) => value.toLocaleLowerCase().includes(text));
    }
  }
}

@Component({
  selector: 'app-filter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, FormDialog],
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
