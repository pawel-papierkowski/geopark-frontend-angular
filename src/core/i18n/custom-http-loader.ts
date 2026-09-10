import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { translationManifest } from './translation-manifest';

/**
 * Custom language loader. Reads manifest file and merges all found json files into single object representing
 * all keys and their translations.
 */
export class CustomHttpLoader extends TranslateLoader {
  constructor(
    private http: HttpClient,
    private basePath: string,
  ) {
    super();
  }

  /**
   * Get translation for given language.
   * @param lang Language code.
   * @returns Translation object that contains all keys and their translations.
   */
  getTranslation(lang: string): Observable<TranslationObject> {
    const files = translationManifest[lang];
    if (!files || files.length === 0) return of({});

    const requests = files.map((file) =>
      this.http.get<TranslationObject>(`${this.basePath}${lang}/${file}.json`).pipe(
        catchError(() => of({})),
      ),
    );

    return forkJoin(requests).pipe(
      map((results) => results.reduce((merged, current) => deepMerge(merged, current), {})),
    );
  }
}

/**
 * Deeply merges source object into target object.
 * @param target Target object.
 * @param source Source object.
 * @returns Result of merge.
 */
function deepMerge(target: TranslationObject, source: TranslationObject): TranslationObject {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (
      typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) &&
      typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key] as TranslationObject, source[key] as TranslationObject);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}
