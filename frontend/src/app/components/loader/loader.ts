import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [],
  templateUrl: './loader.html',
  styleUrl: './loader.scss'
})

export class Loader {
  @Input({ required: true }) testId!: string;
  @Input() message = 'Loading...';
  @Input() size = 72;
  @Input() overlay = false;

  readonly letterPoints = '28.1,24.1 42.9,24.1 39.8,43.1 57.8,43.1 60.4,24.1 75.5,24.1 68.1,75.2 53.5,75.2 56.3,54.5 38.0,54.5 34.7,75.2 20.0,75.2';
}
