import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Application pages (module dashboard and modules) are reachable only by
// navigating inside the application, starting from "Access System" on the
// landing page. In-app navigation does not expose routes in the address bar
// (skipLocationChange). Opening a page directly (typed URL, bookmark, reload
// or browser history) redirects to the landing page.
export const internalNavigationGuard: CanActivateFn = () => {
  const router = inject(Router);
  const startedInsideTheApp = router.navigated && router.currentNavigation()?.trigger === 'imperative';

  return startedInsideTheApp ? true : router.createUrlTree(['/']);
};
