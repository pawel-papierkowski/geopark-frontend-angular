import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { NavAdmin } from './nav-admin';

describe('NavAdmin', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ NavAdmin ],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: 'admin' } } } },
      ],
    }).compileComponents();
  });

  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(NavAdmin);
    await fixture.whenStable();

    // Assert: Page contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('nav')?.textContent).toContain('header.admin.overview');
  });
});
