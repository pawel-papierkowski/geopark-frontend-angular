import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { SectionLayout } from './section-layout';

/**
 * Configures TestBed for SectionLayout with an ActivatedRoute stub carrying given route data.
 * @param data Route data to expose through the ActivatedRoute stub.
 */
async function arrangeTestBed(data: unknown): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [ SectionLayout ],
    providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { data } } },
    ],
  }).compileComponents();
}

describe('SectionLayout', () => {
  it('should render content when route data carries a valid section', async () => {
    // Arrange: Configure TestBed with valid route data.
    await arrangeTestBed({ section: 'public' });

    // Act: Create component.
    const fixture = TestBed.createComponent(SectionLayout);
    await fixture.whenStable();

    // Assert: Layout contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')?.textContent).toContain('header.public.landing');
  });

  it('should render a skip link as the first focusable element, targeting main content', async () => {
    // Arrange: Configure TestBed with valid route data.
    await arrangeTestBed({ section: 'public' });

    // Act: Create component.
    const fixture = TestBed.createComponent(SectionLayout);
    await fixture.whenStable();

    // Assert: Skip link precedes the header and points at the page main landmark (WCAG 2.4.1).
    const compiled = fixture.nativeElement as HTMLElement;
    const skipLink = compiled.querySelector<HTMLAnchorElement>('a.skip-link');
    expect(skipLink, 'layout should render a skip link').not.toBeNull();
    expect(skipLink!.getAttribute('href'), 'skip link should target the main content id').toBe('#main-content');
    expect(skipLink!.getAttribute('data-testid'), 'skip link should be identifiable in tests').toBe('skip-link');
    expect(compiled.firstElementChild, 'skip link should be the first focusable element').toBe(skipLink);
    expect(
      compiled.querySelector('app-header'),
      'skip link should come before the header it bypasses',
    ).not.toBeNull();
  });

  it('should throw when route data section is missing', async () => {
    // Arrange: Configure TestBed without section data.
    await arrangeTestBed({});

    // Act & Assert: Component creation fails fast instead of rendering with undefined section.
    expect(
      () => TestBed.createComponent(SectionLayout),
      'missing route data "section" must throw a descriptive error'
    ).toThrow(/route data 'section' is missing or invalid/);
  });

  it('should throw when route data section is not a known section', async () => {
    // Arrange: Configure TestBed with an out-of-contract section value.
    await arrangeTestBed({ section: 'unknown' });

    // Act & Assert: Component creation fails fast instead of silently rendering public nav.
    expect(
      () => TestBed.createComponent(SectionLayout),
      'invalid route data "section" must throw a descriptive error'
    ).toThrow(/route data 'section' is missing or invalid \(received: unknown\)/);
  });
});
