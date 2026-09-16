import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { NavLink } from './nav-link';

describe('NavLink', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ NavLink ],
      providers: [
        provideRouter([
          { path: 'about', component: NavLink },
          { path: 'dev/components', component: NavLink },
          { path: '**', component: NavLink },
        ]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: 'dev' } } } },
      ],
    }).compileComponents();
  });

  /**
   * Create the component with given inputs.
   * @param currSection Value for `currSection` input.
   * @param target Value for `target` input.
   * @param name Value for `name` input.
   * @returns Fixture of the created component.
   */
  async function arrangeNavLink(currSection: 'public' | 'dev', target: string, name: string) {
    const fixture = TestBed.createComponent(NavLink);
    fixture.componentRef.setInput('currSection', currSection);
    fixture.componentRef.setInput('target', target);
    fixture.componentRef.setInput('name', name);
    await fixture.whenStable();
    return fixture;
  }

  it('should render content for public section', async () => {
    // Arrange: Create component.
    const fixture = await arrangeNavLink('public', '/about', 'about');

    // Assert: Component contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a')?.textContent).toContain('header.public.about.content');
    expect(compiled.querySelector('a')?.getAttribute('data-testid')).toContain('public-nav.about');
    expect(compiled.querySelector('a')?.getAttribute('aria-label')).toContain('header.public.about.label');

    // Assert: Component contains correct styles.
    expect(compiled.querySelector('a')?.classList.contains('app-nav-link')).toBe(true);
    expect(compiled.querySelector('a')?.classList.contains('current-page')).toBe(false);
  });

  it('should render content for dev section', async () => {
    // Arrange: Create component.
    const fixture = await arrangeNavLink('dev', '/', 'dashboard');

    // Assert: Component contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a')?.textContent).toContain('header.dev.dashboard.content');
    expect(compiled.querySelector('a')?.getAttribute('data-testid')).toContain('dev-nav.dashboard');
    expect(compiled.querySelector('a')?.getAttribute('aria-label')).toContain('header.dev.dashboard.label');

    // Assert: Component contains correct styles.
    expect(compiled.querySelector('a')?.classList.contains('app-nav-link')).toBe(true);
    expect(compiled.querySelector('a')?.classList.contains('current-page')).toBe(true);
  });

  it('should be active on target path with query parameters', async () => {
    // Arrange: Create component targeting /about, then navigate with query params.
    const fixture = await arrangeNavLink('public', '/about', 'about');
    const router = TestBed.inject(Router);

    // Act: Navigate to /about with query parameters.
    await router.navigateByUrl('/about?x=1');
    await fixture.whenStable();

    // Assert: Link is marked as current page.
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.classList.contains('current-page'), 'query params should not break active state').toBe(true);
    expect(link?.getAttribute('aria-current'), 'current page should expose aria-current').toBe('page');
  });

  it('should be active on target path with fragment', async () => {
    // Arrange: Create component targeting /about, then navigate with fragment.
    const fixture = await arrangeNavLink('public', '/about', 'about');
    const router = TestBed.inject(Router);

    // Act: Navigate to /about with a fragment.
    await router.navigateByUrl('/about#details');
    await fixture.whenStable();

    // Assert: Link is marked as current page.
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.classList.contains('current-page'), 'fragment should not break active state').toBe(true);
    expect(link?.getAttribute('aria-current'), 'current page should expose aria-current').toBe('page');
  });

  it('should not be active for root target on other pages', async () => {
    // Arrange: Create root-target component, then navigate away from root.
    const fixture = await arrangeNavLink('dev', '/', 'dashboard');
    const router = TestBed.inject(Router);

    // Act: Navigate to a non-root path.
    await router.navigateByUrl('/dev/components');
    await fixture.whenStable();

    // Assert: Root link is not marked as current page.
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.classList.contains('current-page'), 'root target must match only exact root path').toBe(false);
    expect(link?.getAttribute('aria-current'), 'inactive link must not expose aria-current').toBeNull();
  });

  it('should mark only the current dev page when navigating between dashboard and components', async () => {
    const dashboard = await arrangeNavLink('dev', '/dev', 'dashboard');
    const components = await arrangeNavLink('dev', '/dev/components', 'components');
    const router = TestBed.inject(Router);
    const dashboardLink = (dashboard.nativeElement as HTMLElement).querySelector('[data-testid="dev-nav.dashboard"]');
    const componentsLink = (components.nativeElement as HTMLElement).querySelector('[data-testid="dev-nav.components"]');

    for (const url of ['/dev', '/dev/components', '/dev/components?x=1#details', '/dev']) {
      await router.navigateByUrl(url);
      await Promise.all([dashboard.whenStable(), components.whenStable()]);

      const dashboardActive = url === '/dev';
      expect(dashboardLink?.classList.contains('current-page'), `Dashboard active state at ${url}`).toBe(dashboardActive);
      expect(dashboardLink?.getAttribute('aria-current'), `Dashboard ARIA state at ${url}`).toBe(dashboardActive ? 'page' : null);
      expect(componentsLink?.classList.contains('current-page'), `Components active state at ${url}`).toBe(!dashboardActive);
      expect(componentsLink?.getAttribute('aria-current'), `Components ARIA state at ${url}`).toBe(dashboardActive ? null : 'page');
    }
  });

  it.each([
    { target: '/about', url: '/about/', active: true },
    { target: '/about/', url: '/about', active: true },
    { target: '/admin', url: '/administration', active: false },
    { target: '/dev/components', url: '/dev', active: false },
    { target: '/', url: '/?x=1#details', active: true },
  ])('should match $target against $url as $active', async ({ target, url, active }) => {
    const fixture = await arrangeNavLink('public', target, 'test');
    const router = TestBed.inject(Router);

    await router.navigateByUrl(url);
    await fixture.whenStable();

    const link = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="public-nav.test"]');
    expect(link?.classList.contains('current-page'), 'active state should respect path boundaries').toBe(active);
    expect(link?.getAttribute('aria-current'), 'ARIA state should follow active state').toBe(active ? 'page' : null);
  });
});
