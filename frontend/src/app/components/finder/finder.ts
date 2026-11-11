import { ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, ViewChild, forwardRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormBuilder, FormControl, FormGroup, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FormDialog } from '../form-dialog/form-dialog';
import { Grid, GridColumn } from '../grid/grid';
import { FilterField, FilterValues, filterRows } from '../filter/filter';

export const FINDER_MIN_SEARCH_LENGTH = 3;

// Read-only field whose value is chosen in a search dialog: the user enters
// criteria, starts the search and selects one record from the results.
@Component({
  selector: 'app-finder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, FormDialog, Grid],
  templateUrl: './finder.html',
  styleUrl: './finder.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Finder), multi: true }]
})

export class Finder<T> implements ControlValueAccessor, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) testIdPrefix!: string;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) items: T[] = [];
  @Input({ required: true }) columns: GridColumn<T>[] = [];
  @Input({ required: true }) searchFields: FilterField<T>[] = [];
  @Input({ required: true }) itemId!: (item: T) => string;
  @Input({ required: true }) itemLabel!: (item: T) => string;
  @Input() itemDisabled: ((item: T) => boolean) | null = null;
  @Input() inputId: string | null = null;
  @Input() placeholder = '';
  @Input() emptyMessage = 'No records found.';
  @Input() clearable = false;
  // Shown when the current value is not among the items (e.g. a record that
  // is no longer eligible but is still assigned).
  @Input() selectedLabel: string | null = null;

  @ViewChild(Grid) grid?: Grid<T>;

  readonly minSearchLength = FINDER_MIN_SEARCH_LENGTH;

  searchForm: FormGroup<Record<string, FormControl<string>>> = this.fb.nonNullable.group({});
  results: T[] = [];
  selectedItem: T | null = null;
  value = '';
  disabled = false;
  isOpen = false;
  searched = false;
  searchError = false;
  submitted = false;

  private lastCriteria: FilterValues = {};
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  get displayValue(): string {
    const item = this.items.find((candidate) => this.itemId(candidate) === this.value);
    return item ? this.itemLabel(item) : (this.value && this.selectedLabel) || '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchFields']) {
      const controls: Record<string, FormControl<string>> = {};

      for (const field of this.searchFields) {
        controls[field.id] = this.fb.nonNullable.control('');
      }

      this.searchForm = this.fb.nonNullable.group(controls);
    }

    // Keep the results of the last search up to date (e.g. availability).
    if (changes['items'] && this.searched) {
      this.results = filterRows(this.items, this.searchFields, this.lastCriteria);
    }
  }

  open(): void {
    if (this.disabled) {
      return;
    }

    this.searchForm.reset();
    this.results = [];
    this.selectedItem = null;
    this.searched = false;
    this.searchError = false;
    this.submitted = false;
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
    this.onTouched();
  }

  search(): void {
    const criteria: FilterValues = {};

    for (const [id, value] of Object.entries(this.searchForm.getRawValue())) {
      if (value.trim()) {
        criteria[id] = value.trim();
      }
    }

    const entries = Object.entries(criteria);
    this.searchError = entries.length === 0 || entries.some(([id, value]) => this.searchLength(id, value) < this.minSearchLength);

    if (this.searchError) {
      return;
    }

    this.lastCriteria = criteria;
    this.results = filterRows(this.items, this.searchFields, criteria);
    this.selectedItem = null;
    this.submitted = false;
    this.searched = true;
    this.grid?.resetPage();
  }

  confirm(): void {
    this.submitted = true;

    if (!this.selectedItem || this.isItemDisabled(this.selectedItem)) {
      return;
    }

    this.value = this.itemId(this.selectedItem);
    this.onChange(this.value);
    this.close();
  }

  clear(): void {
    this.value = '';
    this.onChange(this.value);
    this.onTouched();
  }

  isItemDisabled = (item: T): boolean => this.itemDisabled?.(item) ?? false;

  writeValue(value: string | null): void {
    this.value = value ?? '';
    this.cdr.markForCheck();
  }

  registerOnChange(onChange: (value: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.cdr.markForCheck();
  }

  trackByField(_index: number, field: FilterField<T>): string {
    return field.id;
  }

  // Digit-matched criteria (e.g. CPF) count digits only.
  private searchLength(fieldId: string, value: string): number {
    const field = this.searchFields.find((candidate) => candidate.id === fieldId);
    return field?.match === 'digits' ? value.replace(/\D/g, '').length : value.length;
  }
}
