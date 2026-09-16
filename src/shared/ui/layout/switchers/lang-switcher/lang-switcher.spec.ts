import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import userEvent from '@testing-library/user-event';

import { LangSwitcher } from './lang-switcher';
import { storageKeys } from "@/shared/config/const";

describe('LangSwitcher', () => {
  let translateService: TranslateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ LangSwitcher ],
    }).compileComponents();

    // Note we manually set relevant translation keys due to nature of language switcher.
    // We want to test if language actually changed after using switcher.
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      app: {
        language: {
          label: 'Language',
          name: { pl: 'Polish', en: 'English' },
          flag: { en: '🇬🇧', pl: '🇵🇱' },
        },
      },
    });
    translateService.setTranslation('pl', {
      app: {
        language: {
          label: 'Język',
          name: { pl: 'Polski', en: 'Angielski' },
          flag: { en: '🇬🇧', pl: '🇵🇱' },
        },
      },
    });
  });

  describe('general', () => {
    it('should render flags', async () => {
      // Arrange: Create component.
      const fixture = TestBed.createComponent(LangSwitcher);
      await fixture.whenStable();

      // Assert: Default language is English.
      expect(translateService.currentLang()).toBe('en');

      // Assert: Language switcher contains correct data.
      const compiled = fixture.nativeElement as HTMLElement;
      const flags = compiled.querySelectorAll('.flag-item');

      expect(flags.length).toBe(2);
      expect(flags[0].textContent).toContain('🇬🇧');
      expect(flags[0].getAttribute('title')).toBe('English');
      expect(flags[1].textContent).toContain('🇵🇱');
      expect(flags[1].getAttribute('title')).toBe('Polish');
    });

    it('should switch language', async () => {
      // Arrange: Create component.
      const fixture = TestBed.createComponent(LangSwitcher);
      fixture.detectChanges();

      // Act: Change language.
      fixture.componentInstance.selectLang('pl');
      await fixture.whenStable();

      // Assert: Current language is Polish.
      expect(translateService.currentLang()).toBe('pl');
      // Assert: Language in storage is also Polish.
      expect(localStorage.getItem(storageKeys.language)).toBe('pl');

      // Assert: Language switcher contains correct data after language change.
      const compiled = fixture.nativeElement as HTMLElement;
      const flags = compiled.querySelectorAll('.flag-item');

      expect(flags.length).toBe(2);
      expect(flags[0].textContent).toContain('🇬🇧');
      expect(flags[0].getAttribute('title')).toBe('Angielski'); // would be in English if switch failed
      expect(flags[1].textContent).toContain('🇵🇱');
      expect(flags[1].getAttribute('title')).toBe('Polski'); // would be in English if switch failed
    });
  });

  describe('accessibility', () => {
    it('should render flags with correct ARIA attributes', async () => {
      // Arrange: Create component.
      const fixture = TestBed.createComponent(LangSwitcher);
      await fixture.whenStable();

      // Assert: Flag container has group role and accessible label.
      const compiled = fixture.nativeElement as HTMLElement;
      const group = compiled.querySelector('.flag-container');

      expect(group, 'should have a flag-container element').not.toBeNull();
      expect(group!.getAttribute('role')).toBe('group');
      expect(group!.getAttribute('aria-label')).toBe('Language');

      // Assert: Each flag button has correct ARIA attributes.
      const flags = compiled.querySelectorAll<HTMLButtonElement>('.flag-item');

      expect(flags.length).toBe(2);
      expect(flags[0].tagName).toBe('BUTTON');
      expect(flags[0].getAttribute('aria-label')).toBe('English');
      expect(flags[0].getAttribute('aria-pressed')).toBe('true'); // English is default.
      expect(flags[1].tagName).toBe('BUTTON');
      expect(flags[1].getAttribute('aria-label')).toBe('Polish');
      expect(flags[1].getAttribute('aria-pressed')).toBe('false');
    });

    it('should update aria-pressed when language changes', async () => {
      // Arrange: Create component.
      const fixture = TestBed.createComponent(LangSwitcher);
      await fixture.whenStable();

      const compiled = fixture.nativeElement as HTMLElement;
      const flags = compiled.querySelectorAll<HTMLButtonElement>('.flag-item');

      // Assert: English is active by default.
      expect(flags[0].getAttribute('aria-pressed')).toBe('true');
      expect(flags[1].getAttribute('aria-pressed')).toBe('false');

      // Act: Switch to Polish.
      fixture.componentInstance.selectLang('pl');
      await fixture.whenStable();

      // Assert: Polish is now active.
      expect(flags[0].getAttribute('aria-pressed')).toBe('false');
      expect(flags[1].getAttribute('aria-pressed')).toBe('true');
    });

    it('should support Tab navigation between flag buttons', async () => {
      // Arrange: Create component.
      const user = userEvent.setup();
      const fixture = TestBed.createComponent(LangSwitcher);
      await fixture.whenStable();

      const compiled = fixture.nativeElement as HTMLElement;
      const flags = compiled.querySelectorAll<HTMLButtonElement>('.flag-item');

      // Act: Tab to first flag button.
      await user.tab();

      // Assert: First flag receives focus.
      expect(document.activeElement, 'first flag should receive focus after Tab').toBe(flags[0]);

      // Act: Tab to second flag button.
      await user.tab();

      // Assert: Second flag receives focus.
      expect(document.activeElement, 'second flag should receive focus after Tab').toBe(flags[1]);

      // Assert: Flags are in DOM order matching expected language order (en, pl).
      expect(flags[0].getAttribute('data-testid')).toBe('lang-switcher.en');
      expect(flags[1].getAttribute('data-testid')).toBe('lang-switcher.pl');
    });

    it('should switch language when Enter is pressed on a flag button', async () => {
      // Arrange: Create component.
      const user = userEvent.setup();
      const fixture = TestBed.createComponent(LangSwitcher);
      await fixture.whenStable();

      // Act: Tab twice to get to second flag (Polish), then activate Polish via Enter.
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      await fixture.whenStable();

      // Assert: Language switched to Polish.
      expect(translateService.currentLang()).toBe('pl');
      expect(localStorage.getItem(storageKeys.language)).toBe('pl');
    });

    it('should switch language when Space is pressed on a flag button', async () => {
      // Arrange: Create component.
      const user = userEvent.setup();
      const fixture = TestBed.createComponent(LangSwitcher);
      await fixture.whenStable();

      const compiled = fixture.nativeElement as HTMLElement;
      const flags = compiled.querySelectorAll<HTMLButtonElement>('.flag-item');

      // Act: Tab twice to get to second flag (Polish), then activate Polish via Space.
      await user.tab();
      await user.tab();
      await user.keyboard(' ');
      await fixture.whenStable();

      // Assert: Language switched to Polish.
      expect(translateService.currentLang()).toBe('pl');
      expect(localStorage.getItem(storageKeys.language)).toBe('pl');
    });
  });
});
