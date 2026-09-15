import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppHeader } from './app-header';

describe('AppHeader', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppHeader ],
      providers: [ provideRouter([]) ],
    }).compileComponents();
  });


  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(AppHeader);
    fixture.componentRef.setInput('currSection', 'public');
    await fixture.whenStable();

    // Assert: Header contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')?.textContent).toContain('header.title');
    expect(compiled.querySelector('header-switchers')).toBeTruthy();
  });
});
