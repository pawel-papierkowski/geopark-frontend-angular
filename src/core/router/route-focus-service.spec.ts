import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';

import { RouteFocusService } from './route-focus-service';

/**
 * Minimal two-route application: each route renders a `main#main-content` landmark, mirroring
 * the real page templates. Assertions compare `document.activeElement` against the landmark.
 */
@Component({
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
class HostComponent { }

/** Landing route rendering the focusable main landmark. */
@Component({
  template: `<main id="main-content" tabindex="-1" data-testid="main-landing">landing</main>`,
})
class LandingPageComponent { }

/** About route rendering the focusable main landmark. */
@Component({
  template: `<main id="main-content" tabindex="-1" data-testid="main-about">about</main>`,
})
class AboutPageComponent { }

const testRoutes = [
  { path: '', component: LandingPageComponent },
  { path: 'about', component: AboutPageComponent },
];

/**
 * Unit tests of route focus management.
 */
describe('RouteFocusService', () => {
  /** Router under test, re-fetched per test after the TestBed is configured. */
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter(testRoutes)],
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  it('should not move focus during the initial navigation', async () => {
    // Arrange: Initialize focus management, then let the initial navigation settle.
    TestBed.inject(RouteFocusService).initialize();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();

    // Act: Only the initial navigation has happened.
    // Assert: Initial paint must not steal focus from the address bar (WCAG 2.4.3).
    expect(document.activeElement?.tagName, 'initial navigation should leave focus alone').toBe('BODY');
  });

  it('should move focus to the main landmark after a subsequent navigation', async () => {
    // Arrange: Service initialized before any navigation, then settle the first one.
    TestBed.inject(RouteFocusService).initialize();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.activeElement?.tagName, 'focus should still be on the body before navigating').toBe('BODY');

    // Act: Navigate to the about route.
    await router.navigateByUrl('/about');
    await fixture.whenStable();
    fixture.detectChanges();

    // Assert: Main landmark of the freshly rendered route received focus.
    expect(
      document.activeElement?.getAttribute('data-testid'),
      'focus should land on the new route main landmark',
    ).toBe('main-about');
    expect(document.activeElement?.id, 'focused element should be the main landmark').toBe('main-content');
  });

  it('should be idempotent when initialize is called more than once', async () => {
    // Arrange: Service initialized twice, as a misconfigured root might do.
    const service = TestBed.inject(RouteFocusService);
    service.initialize();
    service.initialize();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();

    // Act: Navigate to the about route.
    await router.navigateByUrl('/about');
    await fixture.whenStable();
    fixture.detectChanges();

    // Assert: Focus moved exactly once - no double subscription fighting over the element.
    expect(
      document.activeElement?.getAttribute('data-testid'),
      'focus should land on the new route main landmark once',
    ).toBe('main-about');
  });
});
