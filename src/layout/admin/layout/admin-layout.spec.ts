import { TestBed } from '@angular/core/testing';

import { AdminLayout } from './admin-layout';

describe('AdminLayout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AdminLayout ],
    }).compileComponents();
  });

  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(AdminLayout);
    await fixture.whenStable();

    // Assert: Layout contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')?.textContent).toContain('header.title');
  });
});
