import { TestBed } from '@angular/core/testing';

import { PageCustomComponents } from './page-custom-components';

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
    expect(compiled.querySelector('main')?.textContent).toContain('CUSTOM COMPONENTS PLACEHOLDER');
  });
});
