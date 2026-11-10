import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type MessageDialogType = 'warning' | 'error' | 'success';

const ICONS: Record<MessageDialogType, string> = {
  warning: 'warning_amber',
  error: 'error_outline',
  success: 'check_circle_outline'
};

@Component({
  selector: 'app-message-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './message-dialog.html',
  styleUrl: './message-dialog.scss'
})

export class MessageDialog implements AfterViewInit, OnDestroy {
  @Input({ required: true }) testIdPrefix!: string;
  @Input({ required: true }) type!: MessageDialogType;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) message!: string;
  @Input() confirmLabel = 'OK';
  @Input() confirmAction = 'ok';
  @Input() cancelLabel: string | null = null;
  @Input() busy = false;
  @Input() busyLabel = 'Please wait...';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('confirmButton') confirmButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('cancelButton') cancelButton?: ElementRef<HTMLButtonElement>;

  private readonly previouslyFocused = inject(DOCUMENT).activeElement as HTMLElement | null;

  get icon(): string {
    return ICONS[this.type];
  }

  ngAfterViewInit(): void {
    (this.cancelButton ?? this.confirmButton)?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  onEscape(event: Event): void {
    event.stopPropagation();

    if (this.busy) {
      return;
    }

    if (this.cancelLabel) {
      this.cancel.emit();
    } else {
      this.confirm.emit();
    }
  }
}
