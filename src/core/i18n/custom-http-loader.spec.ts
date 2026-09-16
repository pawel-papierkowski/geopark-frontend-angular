import { HttpClient, HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

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

  describe('successful load', () => {
    it('should request all manifest files and deep-merge results', async () => {
      // Arrange & Act: Load language and respond to all manifest requests.
      const promise = firstValueFrom(loader.getTranslation('en'));
      httpMock.expectOne('i18n/en/common.json').flush({ common: { save: 'Save' }, deep: { a: { b: '1' } } });
      httpMock.expectOne('i18n/en/layout/footer.json').flush({ deep: { a: { c: '2' } } });
      httpMock.expectOne('i18n/en/layout/header.json').flush({ deep: { a: { b: '2' } } });
      const result = await promise;

      // Assert: Merged object should contain all keys, nested objects merged, later files win.
      expect(result, 'all files should be merged').toEqual({
        common: { save: 'Save' },
        deep: { a: { b: '2', c: '2' } },
      });
    });

    it('should not swallow a failed file even when other files succeed', async () => {
      // Arrange & Act: Load language with one failing file among successful ones.
      const promise = firstValueFrom(loader.getTranslation('pl')).catch((err: unknown) => err);
      httpMock.expectOne('i18n/pl/common.json').flush({ common: { save: 'Zapisz' } });
      httpMock.expectOne('i18n/pl/layout/header.json').flush({ header: { title: 'Nagłówek' } });
      httpMock.expectOne('i18n/pl/layout/footer.json').flush({}, { status: 404, statusText: 'Not Found' });
      const result = await promise;

      // Assert: Whole load should fail instead of returning partial translations.
      expect(result, 'single file failure should reject the whole load').toBeInstanceOf(HttpErrorResponse);
    });

    it('should propagate server errors', async () => {
      // Arrange & Act: Load language with server failure.
      const promise = firstValueFrom(loader.getTranslation('pl')).catch((err: unknown) => err);
      httpMock.expectOne('i18n/pl/layout/footer.json').flush({ footer: { copyright: '©' } });
      httpMock.expectOne('i18n/pl/layout/header.json').flush({ header: { title: 'Nagłówek' } });
      httpMock.expectOne('i18n/pl/common.json').flush({}, { status: 500, statusText: 'Server Error' });
      const result = await promise;

      // Assert: Server error should reject the load.
      expect(result, 'HTTP error should reject the whole load').toBeInstanceOf(HttpErrorResponse);
    });

    it('should propagate network failures', async () => {
      // Arrange & Act: Load language with network failure on one file.
      const promise = firstValueFrom(loader.getTranslation('pl')).catch((err: unknown) => err);
      httpMock.expectOne('i18n/pl/layout/footer.json').flush({ footer: { copyright: '©' } });
      httpMock.expectOne('i18n/pl/layout/header.json').flush({ header: { title: 'Nagłówek' } });
      httpMock.expectOne('i18n/pl/common.json').error(new ProgressEvent('network error'));
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
