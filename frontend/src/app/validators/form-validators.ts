import { AbstractControl, ValidationErrors } from '@angular/forms';

export function requiredTrimmedValidator(control: AbstractControl<string>): ValidationErrors | null {
  return control.value?.trim() ? null : { required: true };
}

// Value for an <input type="datetime-local"> in the browser's time zone.
export function toDateTimeLocal(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function notFutureDateTimeValidator(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && new Date(control.value).getTime() > Date.now() ? { futureDate: true } : null;
}
