import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { NavPublic } from './nav-public';

describe('NavPublic', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ NavPublic ],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: 'public' } } } },
      ],
    }).compileComponents();
  });


  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(NavPublic);
    await fixture.whenStable();

    // Assert: Page contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('nav')?.textContent).toContain('header.public.landing');
  });
});
