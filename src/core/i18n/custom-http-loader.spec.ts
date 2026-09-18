import { HttpClient, HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { translationManifest } from '@/shared/config/translation-manifest';
import { CustomHttpLoader } from './custom-http-loader';

describe('CustomHttpLoader', () => {
  const basePath = 'i18n/';

  let loader: CustomHttpLoader;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    loader = new CustomHttpLoader(TestBed.inject(HttpClient), basePath);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /**
   * Flush all manifest requests for `lang`. Each successful file is flushed
   * with the matching entry from `responses` (or an empty object). When `fail`
   * is provided the last manifest file is flushed with that error instead.
   * @param lang Language code whose manifest files should be flushed.
   * @param options Optional overrides and failure configuration.
   */
  function respond(
    lang: string,
    { responses = {}, fail }: { responses?: Record<string, unknown>; fail?: { status: number; statusText: string } | ProgressEvent } = {},
  ): void {
    const files = translationManifest[lang as keyof typeof translationManifest];
    files.forEach((file, index) => {
      const request = httpMock.expectOne(`${basePath}${lang}/${file}.json`);
      if (fail !== undefined && index === files.length - 1) {
        if (fail instanceof ProgressEvent)  request.error(fail);
        else request.flush({}, fail);
      }
      else request.flush(responses[file] ?? {});
    });
  }

  describe('successful load', () => {
    it('should request all manifest files and deep-merge results', async () => {
      // Arrange & Act: Load language and respond to all manifest requests.
      const promise = firstValueFrom(loader.getTranslation('en'));
      respond('en', {
        responses: {
          common: { common: { save: 'Save' }, deep: { a: { b: '1' } } },
          'layout/footer': { deep: { a: { c: '2' } } },
          'layout/header': { deep: { a: { b: '2' } } },
          'pages/custom-components': { custom: { widget: 'Widget' } },
        },
      });
      const result = await promise;

      // Assert: Merged object should contain all keys, nested objects merged, later files win.
      expect(result, 'all files should be merged').toEqual({
        common: { save: 'Save' },
        deep: { a: { b: '2', c: '2' } },
        custom: { widget: 'Widget' },
      });
    });

    it('should not swallow a failed file even when other files succeed', async () => {
      // Arrange & Act: Load language with one failing file among successful ones.
      const promise = firstValueFrom(loader.getTranslation('pl')).catch((err: unknown) => err);
      respond('pl', { fail: { status: 404, statusText: 'Not Found' } });
      const result = await promise;

      // Assert: Whole load should fail instead of returning partial translations.
      expect(result, 'single file failure should reject the whole load').toBeInstanceOf(HttpErrorResponse);
    });

    it('should propagate server errors', async () => {
      // Arrange & Act: Load language with server failure.
      const promise = firstValueFrom(loader.getTranslation('pl')).catch((err: unknown) => err);
      respond('pl', { fail: { status: 500, statusText: 'Server Error' } });
      const result = await promise;

      // Assert: Server error should reject the load.
      expect(result, 'HTTP error should reject the whole load').toBeInstanceOf(HttpErrorResponse);
    });

    it('should propagate network failures', async () => {
      // Arrange & Act: Load language with network failure on one file.
      const promise = firstValueFrom(loader.getTranslation('pl')).catch((err: unknown) => err);
      respond('pl', { fail: new ProgressEvent('network error') });
      const result = await promise;

      // Assert: Network failure should reject the whole load.
      expect(result, 'network failure should reject the whole load').toBeInstanceOf(HttpErrorResponse);
      expect((result as HttpErrorResponse).status, 'network failure should have zero status').toBe(0);
    });
  });

  describe('unknown language', () => {
    it('should error for language not present in manifest without issuing requests', async () => {
      // Arrange & Act: Load unsupported language.
      const promise = firstValueFrom(loader.getTranslation('de')).catch((err: unknown) => err);
      const result = await promise;

      // Assert: Load should fail with descriptive error and no HTTP call.
      expect(result, 'unknown language should produce error').toBeInstanceOf(Error);
      expect((result as Error).message, 'error should name the language').toContain('de');
      httpMock.expectNone(() => true);
    });
  });
});
