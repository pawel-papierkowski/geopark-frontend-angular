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

  describe('should render content', () => {
    it('in public section', async () => {
      // Arrange: Create component.
      const fixture = TestBed.createComponent(AppHeader);
      fixture.componentRef.setInput('currSection', 'public');
      await fixture.whenStable();

      // Assert: Header contains correct data.
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('header')?.textContent).toContain('header.public.landing.content');
      expect(compiled.querySelector('header-switchers')).toBeTruthy();

      // Assert: Header has correct CSS.
      expect(compiled.querySelector('header')?.classList.contains('app-header')).toBe(true);
      expect(compiled.querySelector('header')?.classList.contains('public')).toBe(true);
    });

    it('in dev section', async () => {
      // Arrange: Create component.
      const fixture = TestBed.createComponent(AppHeader);
      fixture.componentRef.setInput('currSection', 'dev');
      await fixture.whenStable();

      // Assert: Header contains correct data.
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('header')?.textContent).toContain('header.dev.dashboard.content');
      expect(compiled.querySelector('header-switchers')).toBeTruthy();

      // Assert: Header has correct CSS.
      expect(compiled.querySelector('header')?.classList.contains('app-header')).toBe(true);
      expect(compiled.querySelector('header')?.classList.contains('dev')).toBe(true);
    });

    it('in admin section', async () => {
      // Arrange: Create component.
      const fixture = TestBed.createComponent(AppHeader);
      fixture.componentRef.setInput('currSection', 'admin');
      await fixture.whenStable();

      // Assert: Header contains correct data.
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('header')?.textContent).toContain('header.admin.overview.content');
      expect(compiled.querySelector('header-switchers')).toBeTruthy();

      // Assert: Header has correct CSS.
      expect(compiled.querySelector('header')?.classList.contains('app-header')).toBe(true);
      expect(compiled.querySelector('header')?.classList.contains('admin')).toBe(true);
    });
  });
});
