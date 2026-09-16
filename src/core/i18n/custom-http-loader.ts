import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, forkJoin, throwError } from 'rxjs';
import { map } from 'rxjs/operators';

import { translationManifest } from '@/shared/config/translation-manifest';

/**
 * Custom language loader. Reads manifest file and merges all found json files into single object representing
 * all keys and their translations. Fails when language is not known or any translation file cannot be loaded.
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
    const files = this.resolveFiles(lang);
    if (!files) return throwError(() => new Error(`Unknown language '${lang}'.`));

    const requests = files.map((file) => this.http.get<TranslationObject>(`${this.basePath}${lang}/${file}.json`));

    return forkJoin(requests).pipe(
      map((results) => results.reduce((merged, current) => deepMerge(merged, current), {})),
    );
  }

  /**
   * Resolve list of translation files for given language.
   * @param lang Language code.
   * @returns List of files or null when language is not defined in manifest.
   */
  private resolveFiles(lang: string): readonly string[] | null {
    if (!Object.hasOwn(translationManifest, lang)) return null;

    const files: readonly string[] = translationManifest[lang as keyof typeof translationManifest];
    return files && files.length > 0 ? files : null;
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
