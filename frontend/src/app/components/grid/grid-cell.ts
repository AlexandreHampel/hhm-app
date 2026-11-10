import { Directive, Input, TemplateRef, inject } from '@angular/core';

export interface GridCellContext {
  $implicit: any;
}

@Directive({
  selector: 'ng-template[appGridCell]',
  standalone: true
})
export class GridCell {
  readonly template = inject<TemplateRef<GridCellContext>>(TemplateRef);

  @Input({ alias: 'appGridCell', required: true }) columnId!: string;
}
