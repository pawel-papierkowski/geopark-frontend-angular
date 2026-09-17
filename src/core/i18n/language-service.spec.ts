import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { createEnvironmentInjector, EnvironmentInjector, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateLoader, provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { Subscription, throwError } from 'rxjs';

import { storageKeys } from '@/shared/config/const';
import { translationManifest } from '@/shared/config/translation-manifest';
import type { Lang } from '@/shared/config/types';
import { DocumentService } from '@/shared/utils/document-service';

import { CustomHttpLoader } from './custom-http-loader';
import { LanguageService } from './language-service';

describe('LanguageService', () => {
  let languageService: LanguageService;
  let translateService: TranslateService;
  let httpMock: HttpTestingController;
  let injector: EnvironmentInjector;
  let subscriptions: Subscription;
  let activations: string[];
  let originalDocumentLang: string | null;
  let originalStoredLang: string | null;

  /** Prepare an isolated translation environment with a real loader and a fresh coordinator. */
  beforeEach(() => {
    originalDocumentLang = document.documentElement.getAttribute('lang');
    originalStoredLang = localStorage.getItem(storageKeys.language);
    document.documentElement.lang = 'de';
    localStorage.setItem(storageKeys.language, 'pl');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({
          fallbackLang: 'en',
          loader: provideTranslateLoader(() => new CustomHttpLoader(inject(HttpClient), 'i18n/')),
        }),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    translateService = TestBed.inject(TranslateService);
    vi.spyOn(translateService, 'getBrowserLang').mockReturnValue('en');

    injector = createEnvironmentInjector([LanguageService], TestBed.inject(EnvironmentInjector));
    languageService = injector.get(LanguageService);
    activations = [];
    subscriptions = new Subscription();
    subscriptions.add(translateService.onLangChange.subscribe(({ lang }) => activations.push(lang)));
  });

  /** Clean up environment. */
  afterEach(() => {
    try {
      httpMock.verify();
    } finally {
      if (!injector.destroyed) injector.destroy();
      subscriptions.unsubscribe();
      TestBed.resetTestingModule();
      vi.restoreAllMocks();
      if (originalDocumentLang === null) {
        document.documentElement.removeAttribute('lang');
      } else {
        document.documentElement.lang = originalDocumentLang;
      }
      if (originalStoredLang === null) {
        localStorage.removeItem(storageKeys.language);
      } else {
        localStorage.setItem(storageKeys.language, originalStoredLang);
      }
    }
  });

  /**
   * Flush all manifest requests for a language, optionally failing the last one.
   * @param lang Language whose requests should be flushed.
   * @param fail True when the last request should answer with a server error.
   */
  function respond(lang: Lang, fail = false): void {
    const files = translationManifest[lang];
    files.forEach((file, index) => {
      const request = httpMock.expectOne(`i18n/${lang}/${file}.json`);
      if (fail && index === files.length - 1) {
        request.flush({}, { status: 503, statusText: 'Service Unavailable' });
      } else {
        request.flush(file === 'common' ? { languageName: lang } : {});
      }
    });
  }

  /**
   * Snapshot of every observable language state: coordinator signals, document
   * attribute, and persisted preference.
   * @returns Snapshot.
   */
  function state() {
    return {
      active: languageService.activeLanguage(),
      pending: languageService.pendingLanguage(),
      document: document.documentElement.lang,
      stored: localStorage.getItem(storageKeys.language),
    };
  }

  /**
   * Assert that all language state agrees on the given confirmed language:
   * coordinator signals, real translations, document attribute, and preference.
   * @param lang Language expected to be confirmed everywhere.
   */
  function expectConfirmed(lang: Lang): void {
    expect(state(), 'only an activated language should be confirmed and persisted').toEqual({
      active: lang,
      pending: null,
      document: lang,
      stored: lang,
    });
    expect(translateService.currentLang(), 'real translations should match the confirmed language').toBe(lang);
  }

  describe('initialization', () => {
    it('should activate only once when initialize is repeated before and after loading', () => {
      // Arrange
      localStorage.setItem(storageKeys.language, 'en');
      const useSpy = vi.spyOn(translateService, 'use');

      // Act
      languageService.initialize();
      languageService.initialize();
      respond('en');
      languageService.initialize();

      // Assert
      expect(useSpy.mock.calls, 'initialization should request activation only once').toEqual([['en']]);
      expect(activations, 'initialization should emit one real activation').toEqual(['en']);
      expectConfirmed('en');
      httpMock.expectNone(() => true);
    });

    it('should keep the initial language pending until onLangChange confirms activation', () => {
      // Arrange
      expect(translateService.currentLang(), 'fresh provider must not inherit global preselected English').toBeNull();
      expect(languageService.activeLanguage(), 'nothing is confirmed before initialization').toBeNull();
      expect(languageService.pendingLanguage(), 'nothing is requested before initialization').toBeNull();

      // Act
      languageService.initialize();
      expect(state(), 'requesting Polish must not confirm it or change the document').toEqual({
        active: null, pending: 'pl', document: 'de', stored: 'pl',
      });
      expect(translateService.currentLang(), 'ngx-translate eagerly exposes the first requested language').toBe('pl');
      expect(activations, 'an in-flight request is not an activation').toEqual([]);
      respond('en');
      expect(languageService.activeLanguage(), 'loading fallback translations alone must not activate a language').toBeNull();
      respond('pl');

      // Assert
      expect(activations).toEqual(['pl']);
      expectConfirmed('pl');
    });

    it('should leave active and pending null and document and storage untouched when startup and fallback fail', () => {
      // Arrange
      const useSpy = vi.spyOn(translateService, 'use');
      const documentSpy = vi.spyOn(TestBed.inject(DocumentService), 'setDocumentLang');
      const storageSpy = vi.spyOn(Storage.prototype, 'setItem');

      // Act
      languageService.initialize();
      respond('pl', true);
      expect(languageService.pendingLanguage(), 'failed startup should request English fallback').toBe('en');
      respond('en', true);

      // Assert
      expect(state()).toEqual({ active: null, pending: null, document: 'de', stored: 'pl' });
      expect(activations).toEqual([]);
      expect(useSpy.mock.calls, 'fallback must not retry indefinitely').toEqual([['pl'], ['en']]);
      expect(documentSpy, 'failed requests must not update the document').not.toHaveBeenCalled();
      expect(storageSpy, 'failed requests must not persist a preference').not.toHaveBeenCalled();
      httpMock.expectNone(() => true);
    });
  });

  describe('selection races and recovery', () => {
    it('should not clear a newer pending selection when an obsolete startup request fails', () => {
      // Arrange
      const useSpy = vi.spyOn(translateService, 'use');
      languageService.initialize();

      // Act
      languageService.select('en');
      respond('pl', true);
      expect(state(), 'obsolete failure must leave the newer request pending').toEqual({
        active: null, pending: 'en', document: 'de', stored: 'pl',
      });
      expect(useSpy.mock.calls, 'obsolete failure must not start another fallback').toEqual([['pl'], ['en']]);
      respond('en');

      // Assert
      expectConfirmed('en');
      expect(activations).toEqual(['en']);
    });

    it('should retry English after the latest request fails and prevent older Polish from activating', () => {
      // Arrange
      const useSpy = vi.spyOn(translateService, 'use');
      languageService.initialize();

      // Act
      languageService.select('en');
      respond('en', true);
      expect(languageService.activeLanguage(), 'no request has activated yet').toBeNull();
      expect(languageService.pendingLanguage(), 'latest failure should start an English retry').toBe('en');
      respond('en');
      expectConfirmed('en');
      respond('pl');

      // Assert
      expect(useSpy.mock.calls, 'retry must supersede ngx-translate rollback to older Polish').toEqual([['pl'], ['en'], ['en']]);
      expect(activations, 'late Polish completion must not activate even inside TranslateService').toEqual(['en']);
      expectConfirmed('en');
    });

    it('should recover the confirmed language from cache when a normal selection fails', () => {
      // Arrange
      localStorage.setItem(storageKeys.language, 'en');
      languageService.initialize();
      respond('en');
      const useSpy = vi.spyOn(translateService, 'use');

      // Act
      languageService.select('pl');
      expect(state(), 'confirmed English should remain visible while Polish loads').toEqual({
        active: 'en', pending: 'pl', document: 'en', stored: 'en',
      });
      respond('pl', true);

      // Assert
      expect(useSpy.mock.calls, 'recovery should explicitly reassert cached English').toEqual([['pl'], ['en']]);
      expectConfirmed('en');
      expect(activations).toEqual(['en', 'en']);
      httpMock.expectNone(() => true);
    });

    it('should accept another pending request after a synchronous cached selection', () => {
      // Arrange
      respond('en');
      localStorage.setItem(storageKeys.language, 'en');

      // Act
      languageService.initialize();
      expectConfirmed('en');
      languageService.select('pl');
      expect(state(), 'cached completion must not clear the following pending request').toEqual({
        active: 'en', pending: 'pl', document: 'en', stored: 'en',
      });
      respond('pl');

      // Assert
      expectConfirmed('pl');
      expect(activations).toEqual(['en', 'pl']);
      httpMock.expectNone(() => true);
    });

    it('should preserve subscription ordering after synchronous failure starts an asynchronous fallback', () => {
      // Arrange
      const loader = TestBed.inject(TranslateLoader);
      const getTranslation = loader.getTranslation.bind(loader);
      const loaderSpy = vi.spyOn(loader, 'getTranslation').mockImplementation((lang: string) =>
        lang === 'pl' ? throwError(() => new Error('Polish unavailable')) : getTranslation(lang),
      );
      const useSpy = vi.spyOn(translateService, 'use');

      // Act
      languageService.initialize();
      expect(languageService.pendingLanguage(), 'synchronous failure should leave asynchronous fallback pending').toBe('en');
      expect(languageService.activeLanguage()).toBeNull();
      loaderSpy.mockRestore();
      languageService.select('pl');
      respond('en', true);
      expect(languageService.pendingLanguage(), 'obsolete fallback error must not clear the later selection').toBe('pl');
      respond('pl');

      // Assert
      expect(useSpy.mock.calls, 'obsolete fallback must not restart activation').toEqual([['pl'], ['en'], ['pl']]);
      expect(activations).toEqual(['pl']);
      expectConfirmed('pl');
    });
  });

  describe('storage and lifetime', () => {
    it('should initialize from the browser language when reading storage throws', () => {
      // Arrange
      const getItem = Storage.prototype.getItem;
      const storageSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
        if (key === storageKeys.language) throw new DOMException('Storage unavailable', 'SecurityError');
        return getItem.call(this, key);
      });

      // Act
      expect(() => languageService.initialize(), 'storage read failure must not interrupt initialization').not.toThrow();
      storageSpy.mockRestore();
      respond('en');

      // Assert
      expectConfirmed('en');
      expect(activations).toEqual(['en']);
    });

    it('should confirm activation even when persisting storage throws', () => {
      // Arrange
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === storageKeys.language) throw new DOMException('Storage unavailable', 'QuotaExceededError');
        setItem.call(this, key, value);
      });
      localStorage.removeItem(storageKeys.language);

      // Act
      languageService.initialize();
      respond('en');

      // Assert
      expect(state(), 'persistence failure must not prevent confirmation or document synchronization').toEqual({
        active: 'en', pending: null, document: 'en', stored: null,
      });
      expect(activations).toEqual(['en']);
    });

    it.each([false, true])('should have no coordinator effects after injector teardown with pending HTTP (failure=$0)', (fail) => {
      // Arrange
      localStorage.setItem(storageKeys.language, 'en');
      languageService.initialize();
      const documentSpy = vi.spyOn(TestBed.inject(DocumentService), 'setDocumentLang');
      const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
      const useSpy = vi.spyOn(translateService, 'use');

      // Act
      injector.destroy();
      const destroyedState = state();
      respond('en', fail);

      // Assert
      expect(state(), 'destroyed coordinator signals, document and storage must stay unchanged').toEqual(destroyedState);
      expect(documentSpy, 'surviving parent service must not update the document through the coordinator').not.toHaveBeenCalled();
      expect(storageSpy, 'surviving parent service must not persist through the coordinator').not.toHaveBeenCalled();
      expect(useSpy, 'a destroyed coordinator must not initiate recovery').not.toHaveBeenCalled();
      expect(activations, 'parent TranslateService must still receive the HTTP result').toEqual(fail ? [] : ['en']);
      httpMock.expectNone(() => true);
    });
  });
});
