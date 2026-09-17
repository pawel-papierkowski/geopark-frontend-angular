import { HttpClient, provideHttpClient } from '@angular/common/http';
import { DOCUMENT, inject } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateLoader, provideTranslateService, TranslateService } from '@ngx-translate/core';
import { config, throwError } from 'rxjs';

import { CustomHttpLoader } from '@/core/i18n/custom-http-loader';
import { fallbackLang, storageKeys } from '@/shared/config/const';
import { translationManifest } from '@/shared/config/translation-manifest';
import type { Lang } from '@/shared/config/types';

import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  let originalLang: string | null;
  let storedLang: string | null;

  /** Prepare environment. */
  beforeEach(async () => {
    originalLang = document.documentElement.getAttribute('lang');
    storedLang = localStorage.getItem(storageKeys.language);
    localStorage.removeItem(storageKeys.language);
    await TestBed.configureTestingModule({
      imports: [ App ],
    }).compileComponents();
  });

  /** Clean up environment. */
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
    { stored: 'PL', browser: 'en', expected: 'pl' },
    { stored: 'eN', browser: 'pl', expected: 'en' },
    { stored: 'invalid', browser: 'pl', expected: 'pl' },
    { stored: 'invalid', browser: 'de', expected: 'en' },
    { stored: 'invalid', browser: undefined, expected: 'en' },
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

describe('App language integration', () => {
  let fixture: ComponentFixture<App>;
  let httpMock: HttpTestingController;
  let translateService: TranslateService;
  let originalLang: string | null;
  let storedLang: string | null;
  let originalUnhandledError: typeof config.onUnhandledError;

  const languageNames = {
    en: { en: 'English', pl: 'Polish' },
    pl: { en: 'Angielski', pl: 'Polski' },
  };

  /** Prepare an isolated translation environment with a real loader and a fresh coordinator. */
  beforeEach(async () => {
    originalLang = document.documentElement.getAttribute('lang');
    storedLang = localStorage.getItem(storageKeys.language);
    originalUnhandledError = config.onUnhandledError;
    localStorage.removeItem(storageKeys.language);
    document.documentElement.lang = 'en';

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({
          fallbackLang,
          loader: provideTranslateLoader(() => new CustomHttpLoader(inject(HttpClient), 'i18n/')),
        }),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    translateService = TestBed.inject(TranslateService);
    vi.spyOn(translateService, 'getBrowserLang').mockReturnValue('en');
  });

  /** Clean up environment. */
  afterEach(() => {
    vi.useRealTimers();
    config.onUnhandledError = originalUnhandledError;
    vi.restoreAllMocks();
    fixture?.destroy();
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
    httpMock.verify();
  });

  /**
   * Start the application with the given stored language preference.
   * @param language Language to persist before bootstrapping the app.
   */
  async function start(language: Lang): Promise<void> {
    localStorage.setItem(storageKeys.language, language);
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
  }

  /**
   * Get a language button from the rendered switcher.
   * @param language Language whose button should be returned.
   * @returns Button element for the requested language.
   */
  function button(language: Lang): HTMLButtonElement {
    const element = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>(`[data-testid="lang-switcher.${language}"]`);
    expect(element, `${language} button should exist in the routed header`).not.toBeNull();
    return element!;
  }

  /**
   * Flush all manifest requests for a language, optionally failing the last one,
   * then run change detection.
   * @param language Language whose requests should be flushed.
   * @param fail True when the last request should answer with a server error.
   */
  function respond(language: Lang, fail = false): void {
    const files = translationManifest[language];
    files.forEach((file, index) => {
      const request = httpMock.expectOne(`i18n/${language}/${file}.json`);
      if (fail && index === files.length - 1) {
        request.flush({}, { status: 503, statusText: 'Service Unavailable' });
      } else {
        request.flush(file === 'common' ? {
          app: {
            language: {
              label: language === 'en' ? 'Language' : 'Język',
              name: languageNames[language],
              flag: { en: 'EN', pl: 'PL' },
            },
          },
        } : {});
      }
    });
    fixture.detectChanges();
  }

  /**
   * Snapshot of observable language state.
   * @returns State.
   */
  function currentState() {
    return {
      translation: button('pl').title,
      active: translateService.currentLang(),
      document: document.documentElement.lang,
      englishPressed: button('en').getAttribute('aria-pressed'),
      polishPressed: button('pl').getAttribute('aria-pressed'),
    };
  }

  /**
   * Asserts language state.
   * @param language Language.
   * @param persisted Persisted language.
   */
  function expectLanguage(language: Lang, persisted = language): void {
    expect({ ...currentState(), stored: localStorage.getItem(storageKeys.language) }, 'translations, document, preference, and selected button should agree').toEqual({
      translation: languageNames[language].pl,
      active: language,
      document: language,
      stored: persisted,
      englishPressed: String(language === 'en'),
      polishPressed: String(language === 'pl'),
    });
  }

  it('should keep a newer selection when the startup language succeeds last', async () => {
    // Arrange
    await start('pl');
    expect(translateService.currentLang(), 'startup should request Polish').toBe('pl');

    // Act
    button('en').click();
    respond('en');
    expectLanguage('en');
    respond('pl');

    // Assert
    expectLanguage('en');
  });

  it('should update the selected button when startup falls back to English', async () => {
    // Arrange
    await start('pl');
    expect(button('pl').getAttribute('aria-pressed'), 'pending Polish must not be marked active').toBe('false');
    expect(button('en').getAttribute('aria-pressed'), 'no language is confirmed before loading').toBe('false');

    // Act
    respond('pl', true);
    respond('en');

    // Assert
    expectLanguage('en');
  });

  it('should not initiate fallback for an obsolete startup failure', async () => {
    // Arrange
    const useSpy = vi.spyOn(translateService, 'use');
    await start('pl');

    // Act
    button('en').click();
    respond('en');
    expectLanguage('en');
    expect(useSpy.mock.calls, 'startup and user selection should each activate once').toEqual([['pl'], ['en']]);
    respond('pl', true);

    // Assert
    expectLanguage('en');
    expect(useSpy.mock.calls, 'obsolete failure must not initiate another activation').toEqual([['pl'], ['en']]);
  });

  it('should synchronize the replacement switcher after navigating during a language load', async () => {
    // Arrange
    await start('en');
    respond('en');
    expectLanguage('en');
    const previousButton = button('pl');

    // Act
    previousButton.click();
    await TestBed.inject(Router).navigateByUrl('/admin');
    fixture.detectChanges();
    expect(button('pl'), 'section navigation should recreate the switcher').not.toBe(previousButton);
    expectLanguage('en');
    respond('pl');

    // Assert
    expectLanguage('pl');
  });

  it('should initialize normally after a successful startup load', async () => {
    // Arrange
    await start('pl');

    // Act
    respond('en');
    respond('pl');

    // Assert
    expectLanguage('pl');
  });

  it('should preserve the confirmed language when an ordinary switch fails', async () => {
    // Arrange
    await start('en');
    respond('en');
    expectLanguage('en');

    // Act
    button('pl').click();
    respond('pl', true);

    // Assert
    expectLanguage('en');
  });

  it('should switch synchronously to an already loaded language', async () => {
    // Arrange
    await start('en');
    respond('en');
    button('pl').click();
    respond('pl');
    expectLanguage('pl');

    // Act
    button('en').click();
    fixture.detectChanges();

    // Assert
    expectLanguage('en');
    httpMock.expectNone(() => true);
  });

  it('should continue initialization when reading the stored language throws', async () => {
    // Arrange
    const storageError = new DOMException('Storage unavailable', 'SecurityError');
    const getItem = Storage.prototype.getItem;
    const readSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === storageKeys.language) throw storageError;
      return getItem.call(this, key);
    });
    fixture = TestBed.createComponent(App);
    let initializationError: unknown;

    // Act
    try {
      fixture.detectChanges();
    } catch (error: unknown) {
      initializationError = error;
    }
    readSpy.mockRestore();
    await TestBed.inject(Router).navigateByUrl('/');
    respond('en');

    // Assert
    expect(initializationError, 'unavailable storage must not interrupt initialization').toBeUndefined();
    expectLanguage('en');
  });

  it('should synchronize the language even when persisting the selection throws', async () => {
    // Arrange
    await start('en');
    respond('en');
    expectLanguage('en');
    const storageError = new DOMException('Storage unavailable', 'QuotaExceededError');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === storageKeys.language) throw storageError;
      setItem.call(this, key, value);
    });
    const reportedErrors: unknown[] = [];
    config.onUnhandledError = (error: unknown) => {
      if (error !== storageError) throw error;
      reportedErrors.push(error);
    };
    vi.useFakeTimers();

    // Act
    button('pl').click();
    respond('pl');
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    // Assert
    expect.soft(reportedErrors, 'storage failures should be handled rather than reported as unhandled').toEqual([]);
    expect.soft({ ...currentState(), stored: localStorage.getItem(storageKeys.language) }, 'translations, document, preference, and selected button should agree').toEqual({
      translation: languageNames.pl.pl,
      active: 'pl',
      document: 'pl',
      stored: 'en',
      englishPressed: 'false',
      polishPressed: 'true',
    });
  });
});
