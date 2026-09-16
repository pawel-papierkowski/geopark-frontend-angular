import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { throwError } from 'rxjs';

import { storageKeys } from '@/shared/config/const';
import { App } from './app';

describe('App', () => {
  let originalLang: string | null;
  let storedLang: string | null;

  beforeEach(async () => {
    originalLang = document.documentElement.getAttribute('lang');
    storedLang = localStorage.getItem(storageKeys.language);
    localStorage.removeItem(storageKeys.language);
    await TestBed.configureTestingModule({
      imports: [ App ],
    }).compileComponents();
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

  it.each([
    { stored: 'pl', browser: 'en', expected: 'pl' },
    { stored: 'en', browser: 'pl', expected: 'en' },
    { stored: 'invalid', browser: 'pl', expected: 'en' },
    { stored: null, browser: 'pl', expected: 'pl' },
    { stored: null, browser: 'de', expected: 'en' },
    { stored: null, browser: undefined, expected: 'en' },
  ])('should initialize document language to $expected with stored=$stored and browser=$browser', async ({ stored, browser, expected }) => {
    if (stored !== null) {
      localStorage.setItem(storageKeys.language, stored);
    }
    const translateService = TestBed.inject(TranslateService);
    vi.spyOn(translateService, 'getBrowserLang').mockReturnValue(browser);
    const testDocument = TestBed.inject(DOCUMENT);
    testDocument.documentElement.lang = expected === 'pl' ? 'en' : 'pl';

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(testDocument.documentElement.lang, 'HTML language should match resolved language').toBe(expected);
    expect(translateService.currentLang(), 'translations should match document language').toBe(expected);
    expect(localStorage.getItem(storageKeys.language), 'resolved language should be persisted').toBe(expected);
  });

  it('should create the app', () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // Assert: Application exists.
    expect(app).toBeTruthy();
  });

  describe('failed language activation', () => {
    it('should attempt fallback once and persist only fallback on preferred-language failure', async () => {
      // Arrange: Preferred (stored) language fails to load; real service used for fallback.
      const translateService = TestBed.inject(TranslateService);
      const testDocument = TestBed.inject(DOCUMENT);
      localStorage.setItem(storageKeys.language, 'pl');
      const origUse = translateService.use.bind(translateService);
      const useSpy = vi.spyOn(translateService, 'use').mockImplementation((lang: string) =>
        lang === 'pl'
          ? throwError(() => new Error('translations unavailable'))
          : origUse(lang),
      );

      // Act: Create app (triggers language activation).
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();

      // Assert: Fallback attempted exactly once after the failure.
      expect(useSpy.mock.calls.filter(([lang]) => lang === 'en'), 'fallback should be attempted exactly once').toHaveLength(1);
      // Assert: Fallback state persisted, failed language not.
      expect(localStorage.getItem(storageKeys.language), 'fallback language should be persisted').toBe('en');
      expect(testDocument.documentElement.lang, 'document language should follow fallback').toBe('en');
    });

    it('should leave state untouched when both preferred and fallback languages fail', async () => {
      // Arrange: All language loads fail.
      const translateService = TestBed.inject(TranslateService);
      const testDocument = TestBed.inject(DOCUMENT);
      localStorage.setItem(storageKeys.language, 'pl');
      const documentLangBefore = testDocument.documentElement.lang;
      const useSpy = vi.spyOn(translateService, 'use').mockReturnValue(throwError(() => new Error('translations unavailable')));

      // Act: Create app (triggers language activation).
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();

      // Assert: Exactly two attempts (preferred + fallback), state untouched.
      expect(useSpy, 'preferred and fallback should be attempted').toHaveBeenCalledTimes(2);
      expect(localStorage.getItem(storageKeys.language), 'failed language should not be persisted').toBe('pl');
      expect(testDocument.documentElement.lang, 'document language should stay untouched').toBe(documentLangBefore);
      expect(fixture.componentInstance, 'app should still be created').toBeTruthy();
    });
  });

  it('should render content', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    // Assert: Application contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
