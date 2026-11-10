import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-form-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './form-dialog.html',
  styleUrl: './form-dialog.scss'
})

export class FormDialog implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input({ required: true }) testIdPrefix!: string;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) formId!: string;
  @Input() submitLabel = 'Save';
  @Input() submitAction = 'save';
  @Input() cancelLabel = 'Cancel';
  @Input() secondaryLabel: string | null = null;
  @Input() secondaryAction = 'clear';
  @Input() busy = false;
  @Input() busyLabel = 'Saving...';

  @Output() cancel = new EventEmitter<void>();
  @Output() secondary = new EventEmitter<void>();

  private readonly previouslyFocused = inject(DOCUMENT).activeElement as HTMLElement | null;

  ngAfterViewInit(): void {
    this.elementRef.nativeElement
      .querySelector<HTMLElement>('.body input, .body select, .body textarea')
      ?.focus();
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  onEscape(event: Event): void {
    event.stopPropagation();

    if (!this.busy) {
      this.cancel.emit();
    }
  }
}
