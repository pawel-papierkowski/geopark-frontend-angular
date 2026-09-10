import { TestBed } from '@angular/core/testing';

import { AppHeader } from './app-header';

describe('AppHeader', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppHeader ],
    }).compileComponents();
  });


  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(AppHeader);
    await fixture.whenStable();

    // Assert: Header contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')?.textContent).toContain('header.title');
  });
});
