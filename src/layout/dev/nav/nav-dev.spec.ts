import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { NavDev } from './nav-dev';

/**
 * Unit tests of dev section navigation.
 */
describe('NavDev', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ NavDev ],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: 'dev' } } } },
      ],
    }).compileComponents();
  });

  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(NavDev);
    await fixture.whenStable();

    // Assert: Page contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('nav')?.textContent).toContain('header.dev.dashboard');
  });
});
