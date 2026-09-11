import { TestBed } from '@angular/core/testing';

import { PageNotFound } from './page-not-found';

describe('PageNotFound', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ PageNotFound ],
    }).compileComponents();
  });


  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(PageNotFound);
    await fixture.whenStable();

    // Assert: Page contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main')?.textContent).toContain('app.page.notFound');
  });
});
