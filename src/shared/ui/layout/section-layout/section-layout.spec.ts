import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { SectionLayout } from './section-layout';

describe('SectionLayout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ SectionLayout ],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: 'public' } } } },
      ],
    }).compileComponents();
  });

  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(SectionLayout);
    await fixture.whenStable();

    // Assert: Layout contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')?.textContent).toContain('header.title');
  });
});
