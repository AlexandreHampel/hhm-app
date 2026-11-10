
import { Injectable } from '@angular/core';
import { Observable, animationFrames, skip, switchMap, take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  afterDraw<T>(request: Observable<T>): Observable<T> {
    return animationFrames().pipe(
      skip(1),
      take(1),
      switchMap(() => request)
    );
  }
}
