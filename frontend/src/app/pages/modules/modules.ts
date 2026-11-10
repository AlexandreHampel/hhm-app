
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { APP_MODULES } from '../../config/modules';

@Component({
  selector: 'app-modules',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './modules.html',
  styleUrl: './modules.scss'
})

export class Modules {
  readonly modules = APP_MODULES;
}
