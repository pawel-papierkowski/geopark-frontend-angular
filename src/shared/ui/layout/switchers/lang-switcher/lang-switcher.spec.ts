import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService, type TranslationObject } from '@ngx-translate/core';
import { Subject, throwError } from 'rxjs';
import userEvent from '@testing-library/user-event';

import { LangSwitcher } from './lang-switcher';
import { storageKeys } from "@/shared/config/const";

describe('LangSwitcher', () => {
  let translateService: TranslateService;
  let originalLang: string | null;
  let storedLang: string | null;

  beforeEach(async () => {
    originalLang = document.documentElement.getAttribute('lang');
    storedLang = localStorage.getItem(storageKeys.language);
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

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalLang === null) {
      document.documentElement.removeAttribute('lang');
    } else {
      document.documentElement.lang = originalLang;
    }
    if (storedLang === null) {
      localStorage.removeItem(storageKeys.language);
    } else {
      localStorage.setItem(storageKeys.language, storedLang);
    }
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

  describe('failed language switch', () => {
    it('should keep previous language when switch fails', async () => {
      // Arrange: Polish load fails, English loads normally.
      const fixture = TestBed.createComponent(LangSwitcher);
      const testDocument = TestBed.inject(DOCUMENT);
      testDocument.documentElement.lang = 'en';
      await fixture.whenStable();
      const storedBefore = localStorage.getItem(storageKeys.language);
      const origUse = translateService.use.bind(translateService);
      vi.spyOn(translateService, 'use').mockImplementation((lang: string) =>
        lang === 'pl'
          ? throwError(() => new Error('translations unavailable'))
          : origUse(lang),
      );
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act: Try to switch to Polish (fails).
      fixture.componentInstance.selectLang('pl');
      await fixture.whenStable();

      // Assert: Previous language kept everywhere, storage untouched.
      expect(fixture.componentInstance.currentLang(), 'component signal should keep previous language').toBe('en');
      expect(translateService.currentLang(), 'translation service should keep previous language').toBe('en');
      expect(testDocument.documentElement.lang, 'document language should stay English').toBe('en');
      expect(localStorage.getItem(storageKeys.language), 'storage should not be updated on failure').toBe(storedBefore);
    });

    it('should apply only the latest selection when switching rapidly', async () => {
      // Arrange: Controlled deferred responses, Polish resolves after English.
      const fixture = TestBed.createComponent(LangSwitcher);
      const testDocument = TestBed.inject(DOCUMENT);
      testDocument.documentElement.lang = 'en';
      await fixture.whenStable();
      const responses = new Map<string, Subject<TranslationObject>>();
      vi.spyOn(translateService, 'use').mockImplementation((lang: string) => {
        const subject = new Subject<TranslationObject>();
        responses.set(lang, subject);
        return subject.asObservable();
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act: Select Polish, then quickly English; complete English first, then stale Polish.
      fixture.componentInstance.selectLang('pl');
      fixture.componentInstance.selectLang('en');
      responses.get('en')!.next({}); responses.get('en')!.complete();
      responses.get('pl')!.next({}); responses.get('pl')!.complete();
      await fixture.whenStable();

      // Assert: Latest selection (English) wins, stale Polish completion is ignored.
      expect(fixture.componentInstance.currentLang(), 'latest selection should win').toBe('en');
      expect(localStorage.getItem(storageKeys.language), 'storage should hold latest selection').toBe('en');
      expect(testDocument.documentElement.lang, 'document language should hold latest selection').toBe('en');
    });
  });

  describe('accessibility', () => {
    it('should update the document language when switching to Polish and back', async () => {
      const user = userEvent.setup();
      const fixture = TestBed.createComponent(LangSwitcher);
      const testDocument = TestBed.inject(DOCUMENT);
      testDocument.documentElement.lang = 'en';
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      const polishButton = compiled.querySelector<HTMLButtonElement>('[data-testid="lang-switcher.pl"]')!;
      const englishButton = compiled.querySelector<HTMLButtonElement>('[data-testid="lang-switcher.en"]')!;

      await user.click(polishButton);
      await fixture.whenStable();

      expect(testDocument.documentElement.lang, 'Polish content should declare Polish').toBe('pl');
      expect(translateService.currentLang()).toBe('pl');

      await user.click(englishButton);
      await fixture.whenStable();

      expect(testDocument.documentElement.lang, 'English content should declare English').toBe('en');
      expect(translateService.currentLang()).toBe('en');
    });

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
