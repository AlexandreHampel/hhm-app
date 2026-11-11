import { ChangeDetectorRef, Component, EventEmitter, Input, Output, forwardRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface DropdownOption {
  value: string;
  label: string;
  key: string;
}

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Dropdown), multi: true }]
})

export class Dropdown implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) testIdPrefix!: string;
  @Input({ required: true }) options: DropdownOption[] = [];
  @Input() placeholder: string | null = null;
  @Input() placeholderSelectable = false;
  @Input() inputId: string | null = null;
  @Input() ariaLabel: string | null = null;
  @Input() size: 'default' | 'compact' = 'default';
  // Standalone usage (outside reactive forms): [value] and (valueChange).
  @Input() value = '';

  @Output() valueChange = new EventEmitter<string>();

  disabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  select(value: string): void {
    this.value = value;
    this.onChange(value);
    this.valueChange.emit(value);
  }

  touch(): void {
    this.onTouched();
  }

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

  trackByValue(_index: number, option: DropdownOption): string {
    return option.value;
  }
}
