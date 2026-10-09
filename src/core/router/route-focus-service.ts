import { DestroyRef, DOCUMENT, inject, Injector, Service } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';

import { forRender } from '@/shared/utils/render/after-render';

/**
 * `id` of the element that receives focus after a client-side navigation. Every routed page
 * renders exactly one such element (see `main#main-content` in the page templates), which also
 * serves as the target of the skip link.
 */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * Moves keyboard focus to the page's main content after a client-side navigation.
 *
 * Single-page applications swap the whole document without a page load, so the browser leaves
 * focus wherever the user happened to be (typically a header link). Keyboard and screen reader
 * users would otherwise have to re-tab through the header to reach the new content, and receive
 * no announcement that the page changed. Focusing the main landmark after each navigation
 * resolves both problems (WCAG 2.4.3 Focus Order).
 *
 * Deliberate behaviours:
 * - The initial navigation (application start) never moves focus, so first paint does not steal
 *   focus from the address bar or an incoming deep link.
 * - Focus waits one render pass so the freshly activated route has produced its DOM.
 * - `preventScroll` keeps focus management from fighting the router's scroll restoration.
 *
 * Lifecycle: `initialize()` is idempotent and must be called once from the application root.
 * Like `LanguageService`, initialization is explicit so the side effect is visible at the call site.
 */
@Service()
export class RouteFocusService {
  private readonly router = inject(Router);
  /** Captured while still in an injection context, so render hooks can be registered later. */
  private readonly injector = inject(Injector);
  /** Used to end the event subscription when the service is destroyed. */
  private readonly destroyRef = inject(DestroyRef);
  /** Document holding the focusable main landmark; injected rather than read from a global. */
  private readonly document = inject(DOCUMENT);
  /** True until the first navigation completes; the very first navigation never moves focus. */
  private firstNavigation = true;
  /** True once initialization happened; initialization is a one-shot. */
  private initialized = false;

  /**
   * Starts listening for completed navigations. Idempotent; later calls do nothing.
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    // Subscription: react to every navigation that finished successfully.
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef)) // automatically end this subscription when Angular destroys the service
      .subscribe(event => {
        if (!(event instanceof NavigationEnd)) return;
        if (this.firstNavigation) {
          this.firstNavigation = false;
          return;
        }
        void this.focusMainContent();
      });
  }

  /** Focuses the main landmark of the freshly rendered route, without scrolling the viewport. */
  private async focusMainContent(): Promise<void> {
    await forRender(this.injector);
    this.document.getElementById(MAIN_CONTENT_ID)?.focus({ preventScroll: true });
  }
}
