import { TestBed } from '@angular/core/testing';

import { PageOverview } from './page-overview';

describe('PageOverview', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ PageOverview ],
    }).compileComponents();
  });


  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(PageOverview);
    await fixture.whenStable();

    // Assert: Page contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main')?.textContent).toContain('OVERVIEW PAGE PLACEHOLDER');
  });
});
