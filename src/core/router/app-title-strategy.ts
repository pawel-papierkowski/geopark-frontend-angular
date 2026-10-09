import { inject, Service } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, PRIMARY_OUTLET, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { projectProp } from '@/shared/config/const';

/** Name of the route `data` entry that holds the translation key of the document title. */
const titleKeyEntry = 'titleKey';

/**
 * Router title strategy producing localized, page-specific document titles (WCAG 2.4.2 Page Titled).
 *
 * Routes opt in with `data: { titleKey: 'some.translation.key' }`; the deepest route declaring the
 * entry wins. The title is composed as `"<page> - <project>"`, for example `"About - GeoPark"`.
 * Routes without any title key (the landing page) fall back to the bare project name. The native
 * route `title` property is intentionally not used because it cannot be re-resolved on language change.
 *
 * The title is rebuilt on every language activation: the router only reacts to navigation, while
 * translations can change at runtime. Until the title translation is available (application startup
 * before translations load) the static `index.html` title stays in place.
 */
@Service()
export class AppTitleStrategy extends TitleStrategy {
  private readonly translateService = inject(TranslateService);
  private readonly titleService = inject(Title);
  /** Latest finished navigation, remembered so a language change can rebuild its title. */
  private snapshot: RouterStateSnapshot | null = null;

  /** Starts listening for language activations. */
  constructor() {
    super();
    // Subscription: rebuild the title whenever a language becomes active.
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed()) // automatically end this subscription when Angular destroys the service
      .subscribe(() => this.applyTitle());
  }

  /**
   * Remembers the finished navigation and applies its document title.
   * @param snapshot Router state produced by the navigation.
   */
  public override updateTitle(snapshot: RouterStateSnapshot): void {
    this.snapshot = snapshot;
    this.applyTitle();
  }

  /**
   * Builds the document title for the deepest route declaring `data.titleKey`.
   * @param snapshot Router state to read the title key from.
   * @returns `"<page> - GeoPark"`, the bare project name when no route declares a title key,
   * or `undefined` when the title translation is not available yet (the current title is kept).
   */
  public override buildTitle(snapshot: RouterStateSnapshot): string | undefined {
    const titleKey = this.findTitleKey(snapshot.root);
    if (titleKey === undefined) return projectProp.title;
    const page: unknown = this.translateService.instant(titleKey);
    if (typeof page !== 'string' || page === titleKey) return undefined; // Missing or not-yet-loaded translation.
    return page === '' ? projectProp.title : `${page} - ${projectProp.title}`;
  }

  /** Resolves the remembered navigation's title and writes it to the document. */
  private applyTitle(): void {
    if (this.snapshot === null) return;
    const title = this.buildTitle(this.snapshot);
    if (title !== undefined) this.titleService.setTitle(title);
  }

  /**
   * Walks the primary route chain from root to leaf, remembering the last declared title key.
   * @param route Route snapshot to start from.
   * @returns Translation key of the deepest `data.titleKey` entry, or undefined when none exists.
   */
  private findTitleKey(route: ActivatedRouteSnapshot): string | undefined {
    let titleKey: string | undefined;
    let current: ActivatedRouteSnapshot | null = route;
    while (current !== null) {
      const declared: unknown = current.data[titleKeyEntry];
      if (typeof declared === 'string') titleKey = declared;
      current = current.children.find(child => child.outlet === PRIMARY_OUTLET) ?? null;
    }
    return titleKey;
  }
}
