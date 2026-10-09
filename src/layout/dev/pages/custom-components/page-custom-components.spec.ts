import { TestBed } from '@angular/core/testing';

import { PageCustomComponents } from './page-custom-components';

/**
 * Unit tests of dev page demonstrating custom components.
 */
describe('PageCustomComponents', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ PageCustomComponents ],
    }).compileComponents();
  });

  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(PageCustomComponents);
    await fixture.whenStable();

    // Assert: Page contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main')?.textContent).toContain('customComponents.title');
  });

  it('should expose the main landmark as the focus target for the skip link and route focus', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(PageCustomComponents);
    await fixture.whenStable();

    // Assert: Main landmark is uniquely addressable and programmatically focusable.
    const compiled = fixture.nativeElement as HTMLElement;
    const main = compiled.querySelector('main');
    expect(main?.id, 'main should carry the id targeted by the skip link').toBe('main-content');
    expect(main?.getAttribute('tabindex'), 'main should be focusable for route focus management').toBe('-1');
  });
});
