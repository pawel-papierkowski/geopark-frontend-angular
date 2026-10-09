import { TestBed } from '@angular/core/testing';

import { PageDashboard } from './page-dashboard';

/**
 * Unit tests of dev dashboard page.
 */
describe('PageDashboard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ PageDashboard ],
    }).compileComponents();
  });

  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(PageDashboard);
    await fixture.whenStable();

    // Assert: Page contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main')?.textContent).toContain('DASHBOARD PAGE PLACEHOLDER');
  });

  it('should expose the main landmark as the focus target for the skip link and route focus', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(PageDashboard);
    await fixture.whenStable();

    // Assert: Main landmark is uniquely addressable and programmatically focusable.
    const compiled = fixture.nativeElement as HTMLElement;
    const main = compiled.querySelector('main');
    expect(main?.id, 'main should carry the id targeted by the skip link').toBe('main-content');
    expect(main?.getAttribute('tabindex'), 'main should be focusable for route focus management').toBe('-1');
  });
});
