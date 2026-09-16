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
  );

  readonly isActive = computed(() => this.currentUrl() === this.target());
}
