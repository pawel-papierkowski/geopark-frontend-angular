import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { NavLink } from './nav-link';

describe('NavLink', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ NavLink ],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: 'dev' } } } },
      ],
    }).compileComponents();
  });

  it('should render content for public section', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(NavLink);
    fixture.componentRef.setInput('currSection', 'public');
    fixture.componentRef.setInput('target', '/about');
    fixture.componentRef.setInput('name', 'about');
    await fixture.whenStable();

    // Assert: Component contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a')?.textContent).toContain('header.public.about.content');
    expect(compiled.querySelector('a')?.getAttribute('data-testid')).toContain('public-nav.about');
    expect(compiled.querySelector('a')?.getAttribute('aria-label')).toContain('header.public.about.label');

    // Assert: Component contains correct styles.
    expect(compiled.querySelector('a')?.classList.contains('app-nav-link')).toBe(true);
    expect(compiled.querySelector('a')?.classList.contains('currentPage')).toBe(false);
  });

  it('should render content for dev section', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(NavLink);
    fixture.componentRef.setInput('currSection', 'dev');
    fixture.componentRef.setInput('target', '/');
    fixture.componentRef.setInput('name', 'dashboard');
    await fixture.whenStable();

    // Assert: Component contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a')?.textContent).toContain('header.dev.dashboard.content');
    expect(compiled.querySelector('a')?.getAttribute('data-testid')).toContain('dev-nav.dashboard');
    expect(compiled.querySelector('a')?.getAttribute('aria-label')).toContain('header.dev.dashboard.label');

    // Assert: Component contains correct styles.
    expect(compiled.querySelector('a')?.classList.contains('app-nav-link')).toBe(true);
    expect(compiled.querySelector('a')?.classList.contains('currentPage')).toBe(true);
  });
});
