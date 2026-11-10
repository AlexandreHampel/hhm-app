import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-crud-toolbar',
  standalone: true,
  imports: [],
  templateUrl: './crud-toolbar.html',
  styleUrl: './crud-toolbar.scss'
})

export class CrudToolbar {
  @Input({ required: true }) testIdPrefix!: string;
  @Input() hasSelection = false;
  @Input() disabled = false;

  @Output() add = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
}
