import { TestBed } from '@angular/core/testing';

import { DevLayout } from './dev-layout';

describe('DevLayout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ DevLayout ],
    }).compileComponents();
  });

  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(DevLayout);
    await fixture.whenStable();

    // Assert: Layout contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')?.textContent).toContain('header.title');
  });
});
