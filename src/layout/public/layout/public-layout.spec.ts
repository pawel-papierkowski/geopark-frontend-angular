import { TestBed } from '@angular/core/testing';

import { PublicLayout } from './public-layout';

describe('PublicLayout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ PublicLayout ],
    }).compileComponents();
  });

  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(PublicLayout);
    await fixture.whenStable();

    // Assert: Layout contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')?.textContent).toContain('header.title');
  });
});
