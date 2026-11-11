import { ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnDestroy, ViewChild, forwardRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';
import { toDateTimeLocal } from '../../validators/form-validators';

export type DatePickerMode = 'date' | 'datetime';

interface CalendarDay {
  iso: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  disabled: boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 8;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function numberOptions(count: number): DropdownOption[] {
  return Array.from({ length: count }, (_value, index) => ({ value: pad(index), label: pad(index), key: pad(index) }));
}

// Native date/datetime-local input (typing, browser validation and ISO values)
// with an HHM-styled calendar panel instead of the browser's own picker.
@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule, MatIconModule, Dropdown],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePicker), multi: true }]
})

export class DatePicker implements ControlValueAccessor, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) testIdPrefix!: string;
  @Input() mode: DatePickerMode = 'date';
  @Input() inputId: string | null = null;
  // Same format as the value: YYYY-MM-DD, or YYYY-MM-DDTHH:mm in datetime mode.
  @Input() min: string | null = null;
  @Input() max: string | null = null;

  @ViewChild('calendarButton') calendarButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly weekdays = WEEKDAYS;
  readonly monthOptions: DropdownOption[] = MONTHS.map((label, index) => ({ value: index.toString(), label, key: label.toLowerCase() }));
  readonly hourOptions = numberOptions(24);
  readonly minuteOptions = numberOptions(60);

  value = '';
  disabled = false;
  isOpen = false;
  viewYear = 0;
  viewMonth = 0;
  days: CalendarDay[] = [];
  yearOptions: DropdownOption[] = [];
  panelTop = 0;
  panelLeft = 0;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private readonly onScroll = (): void => {
    this.position();
    this.cdr.markForCheck();
  };

  get inputType(): string {
    return this.mode === 'datetime' ? 'datetime-local' : 'date';
  }

  get hour(): string {
    return this.mode === 'datetime' ? this.value.slice(11, 13) : '';
  }

  get minute(): string {
    return this.mode === 'datetime' ? this.value.slice(14, 16) : '';
  }

  get todayDisabled(): boolean {
    return this.isOutOfRange(this.todayIso());
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.onScroll, true);
  }

  onInput(value: string): void {
    this.setValue(value);

    if (this.isOpen) {
      this.showMonthOf(value);
    }
  }

  touch(): void {
    this.onTouched();
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (this.disabled) {
      return;
    }

    this.isOpen = true;
    this.showMonthOf(this.value || this.todayIso());
    this.position();
    document.addEventListener('scroll', this.onScroll, true);

    // Place the panel using its rendered height (above the input if needed),
    // then move the focus to the selected day (or today).
    this.cdr.detectChanges();
    this.position();
    this.cdr.detectChanges();
    const panel = this.panel?.nativeElement;
    const focusTarget = ['.day.selected', '.day.today', '.day']
      .map((selector) => panel?.querySelector<HTMLButtonElement>(`${selector}:not(:disabled)`))
      .find(Boolean);

    focusTarget?.focus();
  }

  close(restoreFocus = true): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    document.removeEventListener('scroll', this.onScroll, true);
    this.onTouched();

    if (restoreFocus) {
      this.calendarButton?.nativeElement.focus();
    }
  }

  previousMonth(): void {
    this.moveMonth(-1);
  }

  nextMonth(): void {
    this.moveMonth(1);
  }

  changeMonth(month: string): void {
    this.viewMonth = Number(month);
    this.buildDays();
  }

  changeYear(year: string): void {
    this.viewYear = Number(year);
    this.buildDays();
  }

  selectDay(day: CalendarDay): void {
    if (day.disabled) {
      return;
    }

    if (this.mode === 'date') {
      this.setValue(day.iso);
      this.close();
      return;
    }

    const time = this.hour ? `${this.hour}:${this.minute}` : toDateTimeLocal(new Date()).slice(11, 16);
    this.setValue(`${day.iso}T${time}`);
    this.showMonthOf(day.iso);
  }

  changeHour(hour: string): void {
    this.setTime(hour, this.minute || '00');
  }

  changeMinute(minute: string): void {
    this.setTime(this.hour || '00', minute);
  }

  selectToday(): void {
    if (this.mode === 'date') {
      this.setValue(this.todayIso());
      this.close();
      return;
    }

    this.setValue(toDateTimeLocal(new Date()));
    this.showMonthOf(this.value);
  }

  clear(): void {
    this.setValue('');
    this.buildDays();

    if (this.mode === 'date') {
      this.close();
    }
  }

  trackByIso(_index: number, day: CalendarDay): string {
    return day.iso;
  }

  // Escape closes only the calendar, not the dialog or page that contains it.
  @HostListener('keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.isOpen) {
      event.stopPropagation();
      this.close();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isOpen) {
      this.position();
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';

    if (this.isOpen) {
      this.buildDays();
    }

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

    if (disabled) {
      this.close(false);
    }

    this.cdr.markForCheck();
  }

  private setValue(value: string): void {
    this.value = value;
    this.onChange(value);
  }

  private setTime(hour: string, minute: string): void {
    const date = this.value.slice(0, 10) || this.todayIso();
    this.setValue(`${date}T${hour}:${minute}`);
    this.buildDays();
  }

  private moveMonth(offset: number): void {
    const date = new Date(this.viewYear, this.viewMonth + offset, 1);
    this.viewYear = date.getFullYear();
    this.viewMonth = date.getMonth();
    this.buildYearOptions();
    this.buildDays();
  }

  private showMonthOf(value: string): void {
    const [year, month] = value.slice(0, 10).split('-').map(Number);

    if (year && month) {
      this.viewYear = year;
      this.viewMonth = month - 1;
    }

    this.buildYearOptions();
    this.buildDays();
  }

  // 6 weeks starting on Sunday, including the surrounding days of other months.
  private buildDays(): void {
    const first = new Date(this.viewYear, this.viewMonth, 1);
    const today = this.todayIso();
    const selected = this.value.slice(0, 10);
    const days: CalendarDay[] = [];

    for (let index = 0; index < 42; index++) {
      const date = new Date(this.viewYear, this.viewMonth, 1 - first.getDay() + index);
      const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

      days.push({
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === this.viewMonth,
        today: iso === today,
        selected: iso === selected,
        disabled: this.isOutOfRange(iso)
      });
    }

    this.days = days;
  }

  private buildYearOptions(): void {
    const currentYear = new Date().getFullYear();
    const firstYear = Math.min(this.min ? Number(this.min.slice(0, 4)) : currentYear - 120, this.viewYear);
    const lastYear = Math.max(this.max ? Number(this.max.slice(0, 4)) : currentYear + 10, this.viewYear);

    this.yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_value, index) => {
      const year = (lastYear - index).toString();
      return { value: year, label: year, key: year };
    });
  }

  private isOutOfRange(iso: string): boolean {
    return (!!this.min && iso < this.min.slice(0, 10)) || (!!this.max && iso > this.max.slice(0, 10));
  }

  private todayIso(): string {
    return toDateTimeLocal(new Date()).slice(0, 10);
  }

  private position(): void {
    const input = this.elementRef.nativeElement.getBoundingClientRect();
    const panel = this.panel?.nativeElement;
    const height = panel?.offsetHeight ?? 0;
    const width = panel?.offsetWidth ?? 0;
    const spaceBelow = window.innerHeight - input.bottom - PANEL_GAP - VIEWPORT_MARGIN;
    const spaceAbove = input.top - PANEL_GAP - VIEWPORT_MARGIN;
    const top = height <= spaceBelow || spaceBelow >= spaceAbove
      ? input.bottom + PANEL_GAP
      : input.top - height - PANEL_GAP;

    // Below when it fits, otherwise on the side with more room, always inside the viewport.
    this.panelTop = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - height - VIEWPORT_MARGIN));
    this.panelLeft = Math.max(VIEWPORT_MARGIN, Math.min(input.left, window.innerWidth - width - VIEWPORT_MARGIN));
  }
}
