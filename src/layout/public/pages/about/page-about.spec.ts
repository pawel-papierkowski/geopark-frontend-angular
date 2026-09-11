import { TestBed } from '@angular/core/testing';

import { PageAbout } from './page-about';

describe('PageAbout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ PageAbout ],
    }).compileComponents();
  });


  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(PageAbout);
    await fixture.whenStable();

    // Assert: Page contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main')?.textContent).toContain('ABOUT PAGE PLACEHOLDER');
  });
});
