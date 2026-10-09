import { DOCUMENT, inject, Service } from '@angular/core';

/**
 * Service providing access to the web storage (`localStorage`) of the application's browsing
 * context.
 *
 * Single sanctioned access path for production code: the global `localStorage` identifier is
 * restricted by ESLint (`no-restricted-globals`), so the storage reference is resolved through
 * DI - like `DocumentService` does for `DOCUMENT` - and stays replaceable in tests.
 *
 * Contract mirrors the `Storage` interface: `getItem` returns `null` for a missing key and
 * `setItem` persists the value, but both MAY THROW (e.g. `SecurityError` when storage is
 * blocked, `QuotaExceededError` when full). Callers own their error policy - `LanguageService`
 * wraps calls in `try/catch` and treats persistence as best-effort. The only condition this
 * service swallows itself is an unavailable storage (document without a browsing context):
 * reads degrade to `null`, writes become no-ops.
 */
@Service()
export class StorageService {
  private readonly document = inject(DOCUMENT);

  /**
   * Lazily resolve `localStorage` of the document's browsing context. Kept lazy (not a field)
   * so that a throwing `localStorage` getter surfaces inside the CALLER's `try/catch` rather
   * than during service construction.
   * @returns The storage object, or `null` when the document has no browsing context (e.g. a
   * detached document).
   */
  private get storage(): Storage | null {
    return this.document.defaultView?.localStorage ?? null;
  }

  /**
   * Read the value stored under the given key.
   * @param key Storage key.
   * @returns Stored value, `null` when the key is missing or storage is unavailable. May throw
   * when the browser refuses storage access (e.g. `SecurityError`).
   */
  public getItem(key: string): string | null {
    return this.storage?.getItem(key) ?? null;
  }

  /**
   * Persist a value under the given key.
   * @param key Storage key.
   * @param value Value to store.
   * Does nothing when storage is unavailable. May throw when the browser refuses the write
   * (e.g. `QuotaExceededError`).
   */
  public setItem(key: string, value: string): void {
    this.storage?.setItem(key, value);
  }
}
