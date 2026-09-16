import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import userEvent from '@testing-library/user-event';

import { SectionSwitcher } from './section-switcher';

/** Minimal routes matching section targets so RouterLink navigation succeeds. */
const testRoutes: Routes = [
  { path: '', component: SectionSwitcher },
  { path: 'admin', component: SectionSwitcher },
  { path: 'dev', component: SectionSwitcher },
];

describe('SectionSwitcher', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ SectionSwitcher ],
      providers: [ provideRouter(testRoutes) ],
    }).compileComponents();
  });

  describe('general', () => {
    it('should render all section links (except current section) inside nav landmark', async () => {
      // Arrange: Create component.
      const fixture = TestBed.createComponent(SectionSwitcher);
      fixture.componentRef.setInput('currSection', 'public');
      await fixture.whenStable();

      // Assert: Component uses nav landmark with accessible label.
      const compiled = fixture.nativeElement as HTMLElement;
      const nav = compiled.querySelector('nav');

      expect(nav, 'should have a <nav> element').not.toBeNull();
      expect(nav!.getAttribute('aria-label')).toBe('app.section.navLabel');

      // Assert: Section links are rendered inside list items with correct content.
      const links = compiled.querySelectorAll('.section-link');

      expect(links.length).toBe(2); // Current section 'public' is not present.
      expect(links[0].tagName).toBe('A');
      expect(links[0].closest('li'), 'link should be inside <li>').not.toBeNull();
      expect(links[0].textContent).toContain('app.section.icon.dev');
      expect(links[0].getAttribute('aria-label')).toBe('app.section.name.dev');
      expect(links[0].getAttribute('title')).toBe('app.section.name.dev');
      expect(links[1].textContent).toContain('app.section.icon.admin');
      expect(links[1].getAttribute('aria-label')).toBe('app.section.name.admin');
      expect(links[1].getAttribute('title')).toBe('app.section.name.admin');
    });

    it('should render links with correct routerLink targets', async () => {
      // Arrange: Create component.
      const fixture = TestBed.createComponent(SectionSwitcher);
      fixture.componentRef.setInput('currSection', 'admin');
      await fixture.whenStable();

      // Assert: Links point to correct routes.
      const compiled = fixture.nativeElement as HTMLElement;
      const links = compiled.querySelectorAll('.section-link');

      expect(links.length).toBe(2);
      expect(links[0].getAttribute('href')).toBe('/');
      expect(links[1].getAttribute('href')).toBe('/dev');
    });

    it('should use unordered list structure', async () => {
      // Arrange: Create component.
      const fixture = TestBed.createComponent(SectionSwitcher);
      fixture.componentRef.setInput('currSection', 'dev');
      await fixture.whenStable();

      // Assert: Links are inside a <ul>.
      const compiled = fixture.nativeElement as HTMLElement;
      const list = compiled.querySelector('ul');

      expect(list, 'should have a <ul> element').not.toBeNull();
      expect(list!.querySelectorAll('li').length).toBe(2);
    });
  });

  describe('accessibility', () => {
    it('should support keyboard navigation between section links', async () => {
      // Arrange: Create component.
      const user = userEvent.setup();
      const fixture = TestBed.createComponent(SectionSwitcher);
      fixture.componentRef.setInput('currSection', 'public');
      await fixture.whenStable();

      const compiled = fixture.nativeElement as HTMLElement;
      const links = compiled.querySelectorAll<HTMLAnchorElement>('.section-link');

      // Act: Tab to first link.
      await user.tab();

      // Assert: First link receives focus.
      expect(document.activeElement, 'first link should receive focus after Tab').toBe(links[0]);

      // Act: Tab to second link.
      await user.tab();

      // Assert: Second link receives focus.
      expect(document.activeElement, 'second link should receive focus after Tab').toBe(links[1]);

      // Assert: No link has tabindex that would break natural tab order.
      for (const link of links) {
        expect(link.hasAttribute('tabindex'), `link ${link.getAttribute('data-testid')} should not override tab order`).toBe(false);
      }

      // Assert: Links are in DOM order matching expected section order (dev, admin for currSection=public).
      expect(links[0].getAttribute('data-testid')).toBe('section-switcher.dev');
      expect(links[1].getAttribute('data-testid')).toBe('section-switcher.admin');
    });

    it('should navigate when Enter is pressed on a section link', async () => {
      // Arrange: Create component and spy on router navigation.
      const user = userEvent.setup();
      const fixture = TestBed.createComponent(SectionSwitcher);
      fixture.componentRef.setInput('currSection', 'public');
      await fixture.whenStable();

      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl');

      // Act: Tab to first link, then Enter to activate it.
      await user.tab();
      await user.keyboard('{Enter}');
      await fixture.whenStable();

      // Assert: Router navigation was triggered.
      expect(navigateSpy, 'router.navigateByUrl should be called on Enter').toHaveBeenCalled();

      // Cleanup: Destroy fixture before TestBed tears down to avoid injector reuse.
      fixture.destroy();
    });
  });
});
