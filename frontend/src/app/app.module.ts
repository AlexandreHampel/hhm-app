import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { App } from './app';
import { Landing } from './pages/landing/landing';
import { routes } from './app.routes';

@NgModule({
  declarations: [
    App,
    Landing
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(routes),
    MatButtonModule,
    MatIconModule
  ],
  bootstrap: [App]
})
export class AppModule {}