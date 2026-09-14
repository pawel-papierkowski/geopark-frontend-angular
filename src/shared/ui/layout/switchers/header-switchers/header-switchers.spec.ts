import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { HeaderSwitchers } from './header-switchers';

describe('HeaderSwitchers', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ HeaderSwitchers ],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: 'public' } } } },
      ],
    }).compileComponents();
  });

  it('should render switchers properly', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(HeaderSwitchers);
    await fixture.whenStable();

    // Assert: Switchers are present.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('section-switcher')).toBeTruthy();
    expect(compiled.querySelector('lang-switcher')).toBeTruthy();
  });
});
