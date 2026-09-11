import { TestBed } from '@angular/core/testing';

import { PageLanding } from './page-landing';

describe('PageLanding', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ PageLanding ],
    }).compileComponents();
  });


  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(PageLanding);
    await fixture.whenStable();

    // Assert: Page contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main')?.textContent).toContain('LANDING PAGE PLACEHOLDER');
  });
});
