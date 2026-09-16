import { Component, inject, computed, input } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';

import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { Section } from '@/shared/config/types';

/**
 * Navigation link.
 *
 * Example of correct usage:
 * ```
 * <nav class="app-nav-wrapper">
 *   <ul class="app-nav-container">
 *     <li><nav-link target="/" name="landing" /></li>
 *     <li><nav-link target="/about" name="about" /></li>
 *   </ul>
 * </nav>
 * ```
 * Requires presence of language keys:
 * - `'header.[currentSection].'+name()+'.label'` - Key for ARIA label.
 * - `'header.[currentSection].'+name()+'.content'` - Key for actual text of nav link.
 *
 * Inputs:
 * - currSection - Current section.
 * - target - Target for link - must be route. Example: `/about`
 * - name - Key name of link. Used in language keys.
 */
@Component({
  selector: 'nav-link',
  imports: [ TranslatePipe, RouterLink ],
  styleUrl: './nav-link.css',
  templateUrl: './nav-link.html',
})
export class NavLink {
  private readonly router = inject(Router);
  readonly currSection = input.required<Section>();
  readonly target = input.required<string>();
  readonly name = input.required<string>();

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { requireSync: true },
  );

  /**
   * Strip query parameters and fragment from a URL string.
   * @param url URL to clean, may contain `?query` and/or `#fragment` parts.
   * @returns Path part of the URL, with trailing slash removed (except for root `/`).
   */
  private static readonly stripExtraParts = (url: string): string => {
    const path = url.split(/[?#]/)[0];
    // Normalize trailing slash so `/about/` and `/about` compare equal.
    return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  };

  /**
   * Check if this link is the current page.
   * Uses exact matching on the normalized path part of the URL.
   * Query parameters, fragments, and trailing slashes are ignored.
   * Parent targets do not match nested paths (e.g. `/dev` does not match `/dev/components`).
   * @returns True if this link should be marked as current page.
   */
  readonly isActive = computed(() => {
    const path = NavLink.stripExtraParts(this.currentUrl());
    const target = NavLink.stripExtraParts(this.target());
    return path === target;
  });
}
