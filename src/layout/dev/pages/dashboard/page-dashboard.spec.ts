import { TestBed } from '@angular/core/testing';

import { PageDashboard } from './page-dashboard';

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
});
