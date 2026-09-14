import { ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { SectionSwitcher } from './section-switcher';

describe('SectionSwitcher', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ SectionSwitcher ],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: 'public' } } } },
      ],
    }).compileComponents();
  });

  it('should render all sections except current one', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(SectionSwitcher);
    await fixture.whenStable();

    // Assert: Section switcher contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    const sections = compiled.querySelectorAll('.section');

    // we are on public, so 'public' option is not shown
    expect(sections[0].textContent).toContain('app.section.icon.dev');
    expect(sections[0].getAttribute('title')).toBe('app.section.name.dev');
    expect(sections[1].textContent).toContain('app.section.icon.admin');
    expect(sections[1].getAttribute('title')).toBe('app.section.name.admin');
  });
});
