import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HeaderSwitchers } from './header-switchers';

describe('HeaderSwitchers', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ HeaderSwitchers ],
      providers: [ provideRouter([]) ],
    }).compileComponents();
  });

  it('should render switchers properly', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(HeaderSwitchers);
    fixture.componentRef.setInput('currSection', 'public');
    await fixture.whenStable();

    // Assert: Switchers are present.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('section-switcher')).toBeTruthy();
    expect(compiled.querySelector('lang-switcher')).toBeTruthy();
  });

  it('should render the bullet separator as a decoration hidden from assistive technology', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(HeaderSwitchers);
    fixture.componentRef.setInput('currSection', 'public');
    await fixture.whenStable();

    // Act: Query the separator element.
    const compiled = fixture.nativeElement as HTMLElement;
    const separator = compiled.querySelector('[data-testid="header-switchers.separator"]');

    // Assert: Separator renders the bullet and is hidden from AT.
    expect(separator, 'separator element must be rendered').not.toBeNull();
    expect(separator!.textContent, 'separator must show the bullet glyph').toBe('•');
    expect(separator!.getAttribute('aria-hidden'), 'decorative separator must be hidden from AT').toBe('true');
  });
});
