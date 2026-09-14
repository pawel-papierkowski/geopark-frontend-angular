import { TestBed } from '@angular/core/testing';

import { SectionSwitcher } from './section-switcher';

describe('SectionSwitcher', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ SectionSwitcher ],
    }).compileComponents();
  });

  it('should render all section icons except current one', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(SectionSwitcher);
    fixture.componentRef.setInput('currSection', 'public');
    await fixture.whenStable();

    // Assert: Section switcher contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    const sectionIcons = compiled.querySelectorAll('.section-icon');

    // we are on public, so 'public' option is not shown
    expect(sectionIcons[0].textContent).toContain('app.section.icon.dev');
    expect(sectionIcons[0].getAttribute('title')).toBe('app.section.name.dev');
    expect(sectionIcons[1].textContent).toContain('app.section.icon.admin');
    expect(sectionIcons[1].getAttribute('title')).toBe('app.section.name.admin');
  });
});
